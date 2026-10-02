diff --git a/app/home.tsx b/app/home.tsx
index 7b02b99..805e8fc 100644
--- a/app/home.tsx
+++ b/app/home.tsx
@@ -1,715 +1,251 @@
-import { useCallback, useState, useEffect, useRef } from 'react'
-import AsyncStorage from '@react-native-async-storage/async-storage';
-import { Pressable, RefreshControl, ScrollView, Text, View, Image, StyleSheet, Dimensions, Platform, Animated, TextInput, Alert, Modal, ActivityIndicator } from 'react-native'
-import { router, useFocusEffect } from 'expo-router'
-import { supabase } from '@/lib/supabase'
-import { getBrandingLogo, subscribeBrandingLogo } from '@/lib/branding'
-import { LinearGradient } from 'expo-linear-gradient'
-import { MessageCircle, Truck, MapPin, Briefcase, Plus, Sparkles, Map, Bell, Search, Flame, CloudSun, User, Mic, ChevronDown, Wrench, ShieldCheck, Camera, RefreshCw, X } from 'lucide-react-native'
-import BottomNav from '@/components/BottomNav'
-import LocationSelectorModal from '@/components/LocationSelectorModal'
-import { useDynamicIsland } from '@/context/DynamicIslandContext'
-import { getActiveLocation, setActiveLocation, savePermanentMyLocation, subscribeLocation, isExactDistrictMatching, isAllKingdom } from '@/lib/locationSync'
-import TwitterInquiryCard from '@/components/TwitterInquiryCard'
-import { CurrentWeather, describeWeatherCode, loadCurrentWeather } from '@/lib/weather'
-import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation'
-import { registerPushToken } from '@/lib/notifications'
-
-const { width } = Dimensions.get('window');
+import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
+import { ActivityIndicator, Alert, Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
+import { router } from 'expo-router';
+import { LinearGradient } from 'expo-linear-gradient';
+import { Flame, Plus } from 'lucide-react-native';
+
+import { supabase } from '@/lib/supabase';
+import { getBrandingLogo, subscribeBrandingLogo } from '@/lib/branding';
+import { savePermanentMyLocation, type HaynaLocation } from '@/lib/locationSync';
+import {
+  getGreeting,
+  isEmergencyQuestion,
+  isToolQuestion,
+  normalizeSearchText,
+  toFeed,
+  type FeedItem,
+  type HomeTab,
+} from '@/lib/homeUtils';
+import { useDynamicIsland } from '@/context/DynamicIslandContext';
+import { useHomeFeed } from '@/hooks/useHomeFeed';
+import { useHomeLocation } from '@/hooks/useHomeLocation';
+
+import BottomNav from '@/components/BottomNav';
+import LocationSelectorModal from '@/components/LocationSelectorModal';
+import TwitterInquiryCard from '@/components/TwitterInquiryCard';
+import HomeHero from '@/components/home/HomeHero';
+import AtmosphereBar from '@/components/home/AtmosphereBar';
+import StoriesRow from '@/components/home/StoriesRow';
+import ServicesGrid from '@/components/home/ServicesGrid';
+import FeedTabs from '@/components/home/FeedTabs';
+import EmptyState from '@/components/home/EmptyState';
+import { FeedSkeleton, ErrorBanner } from '@/components/home/HomeStates';
+import { LocationGateModal, WeeklyLocationPrompt } from '@/components/home/LocationModals';
+import { styles } from '@/components/home/homeStyles';
+
+const DAY_MS = 24 * 60 * 60 * 1000;
 
 export default function Home() {
-  const [logoUri, setLogoUri] = useState('/assets/branding/HAYNA_LOGO.png?v=2');
   const { showIsland } = useDynamicIsland();
-  const [profile, setProfile] = useState<any>(null);
-  useEffect(() => {
-    getBrandingLogo().then(setLogoUri);
-    return subscribeBrandingLogo(setLogoUri);
-  }, []);
-  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
-  const [questions, setQuestions] = useState<any[]>([]);
-  const [requests, setRequests] = useState<any[]>([]);
-  const [stories, setStories] = useState<any[]>([]);
-  const [refreshing, setRefreshing] = useState(false);
-  const [activeTab, setActiveTab] = useState<'all' | 'emergency' | 'tools' | 'questions' | 'requests' | 'mine'>('all');
-  const [greeting, setGreeting] = useState('');
-  const [searchQuery, setSearchQuery] = useState('');
+  const showToast = useCallback((msg: string) => showIsland(msg, undefined, 'success'), [showIsland]);
 
-  // Location filter state
-  const [selectedRegion, setSelectedRegion] = useState('كل المملكة');
-  const [selectedCity, setSelectedCity] = useState('كل المدن');
-  const [selectedDistrict, setSelectedDistrict] = useState('كل الأحياء');
-  const [locationReady, setLocationReady] = useState(false);
-  const loadingHomeRef = useRef(false);
-  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
-  const [weatherLoading, setWeatherLoading] = useState(false);
+  const [logoUri, setLogoUri] = useState('/assets/branding/HAYNA_LOGO.png?v=2');
+  const [activeTab, setActiveTab] = useState<HomeTab>('all');
+  const [searchQuery, setSearchQuery] = useState('');
+  const [refreshing, setRefreshing] = useState(false);
   const [showLocationModal, setShowLocationModal] = useState(false);
-  const [locationSetupOpen, setLocationSetupOpen] = useState(false);
-  const [locationSetupBusy, setLocationSetupBusy] = useState(false);
-  const [locationSetupMessage, setLocationSetupMessage] = useState('');
-  const [locationPromptVisible, setLocationPromptVisible] = useState(false);
-
-
-  // Unread badge count
-  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
+  const [greeting] = useState(() => getGreeting());
 
-  // Toast feedback state
-
-  // Animation for FAB
-  const pulseAnim = useRef(new Animated.Value(1)).current;
-
-  const showToast = useCallback((msg: string) => {
-    showIsland(msg, undefined, 'success');
-  }, [showIsland]);
+  // The feed hook resolves the saved location; the location hook owns it.
+  // A ref breaks the circular dependency between the two hooks.
+  const applyLocationRef = useRef<(loc: HaynaLocation) => void>(() => {});
+  const feed = useHomeFeed({ onLocation: loc => applyLocationRef.current(loc) });
+  const loc = useHomeLocation({ setProfile: feed.setProfile, showToast });
+  applyLocationRef.current = loc.apply;
 
+  const { setSetupOpen } = loc;
   useEffect(() => {
-    let active = true;
-    const updateWeather = async () => {
-      setWeatherLoading(true);
-      try {
-        const weather = await loadCurrentWeather(selectedRegion, selectedCity, selectedDistrict);
-        if (active) setCurrentWeather(weather);
-      } catch (error) {
-        console.warn('Weather update failed', error);
-        if (active) setCurrentWeather(null);
-      } finally { if (active) setWeatherLoading(false); }
-    };
-    if (!locationReady) return;
-    updateWeather();
-    const interval = setInterval(updateWeather, 30 * 60 * 1000);
-    return () => { active = false; clearInterval(interval); };
-  }, [locationReady, selectedRegion, selectedCity, selectedDistrict]);
+    setSetupOpen(feed.locationIncomplete);
+  }, [feed.locationIncomplete, setSetupOpen]);
 
   useEffect(() => {
-    const hour = new Date().getHours();
-    if (hour < 12) setGreeting('صباح الخير');
-    else setGreeting('مساء الخير');
-
-    // Subscribe to global location sync
-    getActiveLocation().then((loc) => {
-      setSelectedRegion(loc.region);
-      setSelectedCity(loc.city);
-      setSelectedDistrict(loc.district);
-      setLocationReady(true);
-    });
-
-    const unsub = subscribeLocation((loc) => {
-      setSelectedRegion(loc.region);
-      setSelectedCity(loc.city);
-      setSelectedDistrict(loc.district);
-    });
+    getBrandingLogo().then(setLogoUri);
+    return subscribeBrandingLogo(setLogoUri);
+  }, []);
 
-    // Start FAB Pulse
-    Animated.loop(
+  // FAB pulse (stopped on unmount)
+  const pulseAnim = useRef(new Animated.Value(1)).current;
+  useEffect(() => {
+    const loop = Animated.loop(
       Animated.sequence([
         Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
-        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
-      ])
-    ).start();
-
-    return unsub;
-  }, []);
+        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
+      ]),
+    );
+    loop.start();
+    return () => loop.stop();
+  }, [pulseAnim]);
+
+  // ---------- Quick reply ----------
+  const handleQuickReply = useCallback(
+    async (questionId: string, text: string) => {
+      const body = text.trim();
+      if (!body) return;
 
-  const refreshLiveLocation = useCallback(async () => {
-    try {
       const { data: u } = await supabase.auth.getUser();
-      if (!u.user) return false;
-      const device = await getCurrentDeviceLocation();
-      if (!device) return false;
-      const place = await reverseGeocodeDeviceLocation(device);
-      const live = {
-        region: place?.region?.trim() || '',
-        city: place?.city?.trim() || '',
-        district: place?.district?.trim() || '',
-      };
-      if (!live.region || !live.city || !live.district) return false;
-
-      await savePermanentMyLocation(live, true);
-      setSelectedRegion(live.region);
-      setSelectedCity(live.city);
-      setSelectedDistrict(live.district);
-      setProfile((current: any) => ({ ...(current || {}), ...live }));
-      return true;
-    } catch (error) {
-      console.warn('live location refresh failed:', error);
-      return false;
-    }
-  }, []);
-
-  useEffect(() => {
-    // Location is intentionally NOT refreshed on a timer.
-    // It is requested once per 7 days, or manually from Profile.
-    let active = true;
-    const checkLocationAge = async () => {
-      const raw = await AsyncStorage.getItem('@hayna_location_last_auto_check_v1');
-      const last = raw ? Number(raw) : 0;
-      const due = !last || Date.now() - last >= 7 * 24 * 60 * 60 * 1000;
-      if (active && due) setLocationPromptVisible(true);
-    };
-    void checkLocationAge();
-    return () => { active = false; };
-  }, []);
-
-  const acceptWeeklyLocationCheck = useCallback(async () => {
-    setLocationPromptVisible(false);
-    const updated = await refreshLiveLocation();
-    if (updated) {
-      await AsyncStorage.setItem('@hayna_location_last_auto_check_v1', String(Date.now()));
-    } else {
-      setLocationPromptVisible(true);
-      showToast('تعذر تحديد موقعك، حاول مرة أخرى');
-    }
-  }, [refreshLiveLocation, showToast]);
-
-  const load = useCallback(async () => {
-    if (loadingHomeRef.current) return;
-    loadingHomeRef.current = true;
-    try {
-    const { data: auth } = await supabase.auth.getUser();
-    const user = auth.user;
-    if (!user) {
-      router.replace('/auth');
-      return;
-    }
-
-    setCurrentUserId(user.id);
-
-    // Load the stable location once, then reuse it for every Home query.
-    const [profileRes, locationRes] = await Promise.all([
-      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
-      getActiveLocation(),
-    ]);
-
-    const profileData = profileRes.data;
-    const savedLoc = locationRes;
-    const effectiveLoc = profileData?.city && isAllKingdom(savedLoc.city)
-      ? {
-          region: profileData.region || 'المملكة',
-          city: profileData.city,
-          district: profileData.district || 'كل الأحياء',
-        }
-      : savedLoc;
-    const loc = effectiveLoc;
-    setProfile(profileData);
-    setSelectedRegion(loc.region);
-    setSelectedCity(loc.city);
-    setSelectedDistrict(loc.district);
-    setLocationReady(true);
-
-    const locationComplete = !!(profileData?.region && profileData?.city && profileData?.district);
-    setLocationSetupOpen(!locationComplete);
-    if (!locationComplete) {
-      setLocationSetupMessage('حدد موقعك تلقائياً لنربط حسابك بالمنطقة والمدينة والحي.');
-    }
-
-    if (profileData?.city && isAllKingdom(savedLoc.city)) {
-      void setActiveLocation(loc.region, loc.city, loc.district, false);
-    }
-
-    // Fetch the Home feed in parallel instead of waiting section-by-section.
-    const [notificationsRes, storiesRes, questionsRes, requestsRes] = await Promise.all([
-      supabase
-        .from('notifications')
-        .select('id', { count: 'exact', head: true })
-        .eq('user_id', user.id)
-        .is('read_at', null),
-      supabase
-        .from('stories')
-        .select('*, profiles:author_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district)')
-        .gt('expires_at', new Date().toISOString())
-        .order('created_at', { ascending: false })
-        .limit(30),
-      supabase
-        .from('questions')
-        .select('*')
-        .order('created_at', { ascending: false })
-        .limit(30),
-      supabase
-        .from('requests')
-        .select('*')
-        .eq('status', 'open')
-        .order('created_at', { ascending: false })
-        .limit(25),
-    ]);
-
-    setUnreadNotifCount(notificationsRes.count ?? 0);
-
-    const seenStoryAuthors = new Set<string>();
-    const uniqueStories = (storiesRes.data ?? []).filter((s: any) => {
-      if (!s.author_id || seenStoryAuthors.has(s.author_id)) return false;
-      const authorCity = s.profiles?.city || '';
-      const authorDistrict = s.profiles?.district || '';
-      if (!isAllKingdom(loc.city)) {
-        if (loc.city && authorCity && authorCity !== loc.city) return false;
-        if (
-          loc.district &&
-          loc.district !== 'كل الأحياء' &&
-          authorDistrict &&
-          authorDistrict !== loc.district
-        ) return false;
-      }
-      seenStoryAuthors.add(s.author_id);
-      return true;
-    });
-    setStories(uniqueStories);
-
-    if (questionsRes.error) console.log('questions error:', questionsRes.error.message);
-    const uniqueQData = (questionsRes.data ?? []).filter((q: any, index: number, arr: any[]) => {
-      const title = (q.title || '').trim().toLowerCase();
-      return arr.findIndex((item: any) => (item.title || '').trim().toLowerCase() === title) === index;
-    });
-
-    if (uniqueQData.length) {
-      const authorIds = [...new Set(uniqueQData.map((q: any) => q.author_id).filter(Boolean))];
-      const qIds = uniqueQData.map((q: any) => q.id);
-      const [profilesRes, answersRes] = await Promise.all([
-        authorIds.length ? supabase.from('profiles').select('*').in('id', authorIds) : Promise.resolve({ data: [] }),
-        qIds.length ? supabase.from('answers').select('*').in('question_id', qIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
-      ]);
-
-      const profileMap = (profilesRes.data || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
-      const answerAuthorIds = [...new Set((answersRes.data || []).map((a: any) => a.author_id).filter(Boolean))];
-      const { data: answerProfiles } = answerAuthorIds.length
-        ? await supabase.from('profiles').select('*').in('id', answerAuthorIds)
-        : { data: [] };
-      const answerProfileMap = (answerProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
-
-      const answersByQ: Record<string, any[]> = {};
-      (answersRes.data || []).forEach((answer: any) => {
-        answer.profiles = answerProfileMap[answer.author_id] || null;
-        (answersByQ[answer.question_id] ||= []).push(answer);
-      });
-
-      setQuestions(uniqueQData.map((q: any) => ({
-        ...q,
-        profiles: profileMap[q.author_id] || null,
-        answers: answersByQ[q.id] || [],
-        answers_count: (answersByQ[q.id] || []).length,
-      })));
-    } else {
-      setQuestions([]);
-    }
-
-    if (requestsRes.error) console.log('requests error:', requestsRes.error.message);
-    const uniqueRData = (requestsRes.data ?? []).filter((item: any, index: number, arr: any[]) => {
-      const title = (item.title || '').trim().toLowerCase();
-      return arr.findIndex((candidate: any) => (candidate.title || '').trim().toLowerCase() === title) === index;
-    });
-    if (uniqueRData.length) {
-      const requesterIds = [...new Set(uniqueRData.map((item: any) => item.requester_id).filter(Boolean))];
-      const { data: requesterProfiles } = requesterIds.length
-        ? await supabase.from('profiles').select('*').in('id', requesterIds)
-        : { data: [] };
-      const requesterMap = (requesterProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
-      setRequests(uniqueRData.map((item: any) => ({
-        ...item,
-        profiles: requesterMap[item.requester_id] || null,
-      })));
-    } else {
-      setRequests([]);
-    }
-    } finally {
-      loadingHomeRef.current = false;
-    }
-  }, []);
-  useFocusEffect(useCallback(() => { load() }, [load]));
-
-  // Inline Quick Reply Handler
-  const handleQuickReplySubmit = async (questionId: string, text: string) => {
-    const { data: u } = await supabase.auth.getUser();
-    if (!u.user) {
-      Alert.alert('تنبيه', 'يرجى تسجيل الدخول أولاً للرد');
-      return;
-    }
-
-    const { data: newAns, error } = await supabase
-      .from('answers')
-      .insert({
-        question_id: questionId,
-        author_id: u.user.id,
-        body: text.trim()
-      })
-      .select('*')
-      .single();
-
-    if (error) {
-      Alert.alert('خطأ', 'تعذر إرسال الرد: ' + error.message);
-      return;
-    }
-
-    // Optimistic local state update
-    newAns.profiles = profile;
-    setQuestions(prev => prev.map(q => {
-      if (q.id === questionId) {
-        const updatedAnswers = [...(q.answers || []), newAns];
-        return {
-          ...q,
-          answers: updatedAnswers,
-          answers_count: updatedAnswers.length,
-        };
+      if (!u.user) {
+        Alert.alert('تنبيه', 'يرجى تسجيل الدخول أولاً للرد');
+        return;
       }
-      return q;
-    }));
-
-    showToast('تم نشر ردك بنجاح في المحادثة');
-  };
-
-  // Filter questions and requests by selected Saudi region / city / district strictly
-  const normalizedSearch = normalizeSearchText(searchQuery);
-  const matchesSearch = (values: unknown[]) => !normalizedSearch || values.some(value => normalizeSearchText(value).includes(normalizedSearch));
-
-  const filteredQuestions = questions.filter(q => {
-    if (!matchesSearch([q.title, q.body, q.profiles?.display_name, q.profiles?.username, q.city, q.district, q.category])) return false;
-    return isExactDistrictMatching(q, selectedCity, selectedDistrict);
-  });
-
-  const filteredRequests = requests.filter(r => {
-    if (!matchesSearch([r.title, r.description, r.profiles?.display_name, r.profiles?.username, r.city, r.district, r.category])) return false;
-    return isExactDistrictMatching(r, selectedCity, selectedDistrict);
-  });
 
-  // Mine filter: user's own questions and requests
-  const myQuestions = questions.filter(q => q.author_id === currentUserId);
-  const myRequests = requests.filter(r => r.requester_id === currentUserId);
-  const filteredMyQuestions = myQuestions.filter(q => matchesSearch([q.title, q.body, q.profiles?.display_name, q.profiles?.username, q.city, q.district, q.category]));
-  const filteredMyRequests = myRequests.filter(r => matchesSearch([r.title, r.description, r.profiles?.display_name, r.profiles?.username, r.city, r.district, r.category]));
-
-  // Emergency & Tools categorization
-  const emergencyQuestions = filteredQuestions.filter(
-    q => q.is_emergency || q.urgency_level === 'emergency' || (q.title && (q.title.includes('مفقود') || q.title.includes('طارئ') || q.title.includes('حادث')))
-  );
-
-  const toolQuestions = filteredQuestions.filter(
-    q => q.is_tool_sharing || q.item_type === 'tool_sharing' || (q.title && (q.title.includes('إعارة') || q.title.includes('دريل') || q.title.includes('سلم')))
-  );
+      const { data: newAns, error } = await supabase
+        .from('answers')
+        .insert({ question_id: questionId, author_id: u.user.id, body })
+        .select('*')
+        .single();
 
-  async function setupRequiredLocation() {
-    if (locationSetupBusy) return;
-    setLocationSetupBusy(true);
-    setLocationSetupMessage('جارٍ تحديد موقعك وقراءة المنطقة والمدينة والحي…');
-    try {
-      const device = await getCurrentDeviceLocation();
-      if (!device) {
-        setLocationSetupMessage('لم نتمكن من الوصول إلى موقعك. فعّل إذن الموقع ثم اضغط المحاولة مرة أخرى.');
-        return;
-      }
-      const place = await reverseGeocodeDeviceLocation(device);
-      if (!place?.region || !place?.city || !place?.district) {
-        setLocationSetupMessage('تم تحديد موقعك، لكن لم نستطع استخراج المنطقة والمدينة والحي بدقة. حاول مرة أخرى.');
+      if (error || !newAns) {
+        Alert.alert('خطأ', 'تعذر إرسال الرد: ' + (error?.message ?? 'حاول مرة أخرى'));
         return;
       }
 
-      await savePermanentMyLocation({
-        region: place.region,
-        city: place.city,
-        district: place.district,
-      }, true);
+      const answer = { ...newAns, profiles: feed.profile };
+      feed.setQuestions(prev =>
+        prev.map(q => {
+          if (q.id !== questionId) return q;
+          const answers = [...(q.answers || []), answer];
+          return { ...q, answers, answers_count: answers.length };
+        }),
+      );
+      showToast('تم نشر ردك بنجاح في المحادثة');
+    },
+    [feed.profile, feed.setQuestions, showToast],
+  );
 
-      setSelectedRegion(place.region);
-      setSelectedCity(place.city);
-      setSelectedDistrict(place.district);
-      setProfile((current: any) => ({ ...(current || {}), region: place.region, city: place.city, district: place.district }));
-      setLocationSetupMessage('تم حفظ موقعك. نطلب الآن تفعيل الإشعارات حتى لا تفوتك تنبيهات الحي…');
+  // ---------- Filtering ----------
+  const q = normalizeSearchText(searchQuery);
+  const searching = q.length > 0;
 
-      const pushToken = await registerPushToken();
-      setLocationSetupOpen(false);
-      if (!pushToken) {
-        showToast('تم حفظ موقعك. يمكنك تفعيل الإشعارات لاحقاً من الإعدادات.');
-        return;
-      }
+  const matches = useCallback(
+    (values: unknown[]) => !q || values.some(v => normalizeSearchText(v).includes(q)),
+    [q],
+  );
 
-      showToast('تم ربط حسابك بموقعك وتفعيل الإشعارات ✓');
-    } catch (error: any) {
-      setLocationSetupMessage(error?.message || 'تعذر إكمال الإعداد. حاول مرة أخرى.');
-    } finally {
-      setLocationSetupBusy(false);
+  const { questions, requests, currentUserId } = feed;
+  const { matchesLocation } = loc;
+
+  const derived = useMemo(() => {
+    const qSearch = (x: any) =>
+      matches([x.title, x.body, x.profiles?.display_name, x.profiles?.username, x.city, x.district, x.category]);
+    const rSearch = (x: any) =>
+      matches([x.title, x.description, x.profiles?.display_name, x.profiles?.username, x.city, x.district, x.category]);
+
+    const filteredQuestions = questions.filter(x => qSearch(x) && matchesLocation(x));
+    const filteredRequests = requests.filter(x => rSearch(x) && matchesLocation(x));
+    const myQuestions = questions.filter(x => x.author_id === currentUserId);
+    const myRequests = requests.filter(x => x.requester_id === currentUserId);
+
+    return {
+      filteredQuestions,
+      filteredRequests,
+      myCount: myQuestions.length + myRequests.length,
+      filteredMyQuestions: myQuestions.filter(qSearch),
+      filteredMyRequests: myRequests.filter(rSearch),
+      emergency: filteredQuestions.filter(isEmergencyQuestion),
+      tools: filteredQuestions.filter(isToolQuestion),
+    };
+  }, [questions, requests, currentUserId, matches, matchesLocation]);
+
+  const items: FeedItem[] = useMemo(() => {
+    switch (activeTab) {
+      case 'emergency': return toFeed(derived.emergency, []);
+      case 'tools': return toFeed(derived.tools, []);
+      case 'questions': return toFeed(derived.filteredQuestions, []);
+      case 'requests': return toFeed([], derived.filteredRequests);
+      case 'mine': return toFeed(derived.filteredMyQuestions, derived.filteredMyRequests);
+      default: return toFeed(derived.filteredQuestions, derived.filteredRequests);
     }
-  }
-
-  async function enableRequiredNotifications() {
-    if (locationSetupBusy) return;
-    setLocationSetupBusy(true);
-    setLocationSetupMessage('جارٍ طلب إذن الإشعارات…');
-    try {
-      const token = await registerPushToken();
-      setLocationSetupOpen(false);
-      if (!token) {
-        showToast('تم الدخول. الإشعارات غير مفعلة ويمكن تفعيلها لاحقاً من الإعدادات.');
+  }, [activeTab, derived]);
+
+  // Real activity: distinct neighbours who posted in the visible area during the last 24h.
+  const activeNeighbors = useMemo(() => {
+    const since = Date.now() - DAY_MS;
+    const ids = new Set<string>();
+    derived.filteredQuestions.forEach(x => new Date(x.created_at).getTime() > since && ids.add(x.author_id));
+    derived.filteredRequests.forEach(x => new Date(x.created_at).getTime() > since && ids.add(x.requester_id));
+    feed.stories.forEach(s => s.author_id && ids.add(s.author_id));
+    return ids.size;
+  }, [derived.filteredQuestions, derived.filteredRequests, feed.stories]);
+
+  const onRefresh = useCallback(async () => {
+    setRefreshing(true);
+    await feed.reload();
+    setRefreshing(false);
+  }, [feed.reload]);
+
+  const handleLocationSelect = useCallback(
+    (region: string, city: string, district: string) => {
+      loc.apply({ region, city, district });
+      const incomplete =
+        !region || !city || !district ||
+        city === 'كل المدن' || district === 'كل الأحياء' || district === 'كل أحياء المدينة';
+      if (incomplete) {
+        showToast('حدد المنطقة والمدينة والحي لإكمال موقعك');
         return;
       }
-      showToast('تم تفعيل إشعارات حيّك ✓');
-    } finally {
-      setLocationSetupBusy(false);
-    }
-  }
+      void savePermanentMyLocation({ region, city, district }, true);
+    },
+    [loc.apply, showToast],
+  );
+
+  const emergencyTop = derived.emergency[0];
 
   return (
     <View style={styles.container}>
+      <LocationGateModal
+        visible={loc.setupOpen}
+        busy={loc.setupBusy}
+        message={loc.setupMessage}
+        region={loc.region}
+        city={loc.city}
+        district={loc.district}
+        hasExactLocation={loc.hasExactLocation}
+        onSetupLocation={loc.setupRequiredLocation}
+        onEnableNotifications={loc.enableNotifications}
+      />
 
-      {/* Mandatory first-login setup: location + notifications */}
-      <Modal visible={locationSetupOpen} transparent animationType="fade" onRequestClose={() => {}}>
-        <View style={styles.locationGateOverlay}>
-          <View style={styles.locationGateCard}>
-            <View style={styles.locationGateIcon}><MapPin size={28} color="#059669" /></View>
-            <Text style={styles.locationGateTitle}>نحتاج موقعك قبل البدء</Text>
-            <Text style={styles.locationGateText}>
-              حدّد موقعك تلقائياً لربط حسابك بالمنطقة والمدينة والحي، ثم فعّل الإشعارات لتصلك أخبار وتنبيهات حيّك فوراً.
-            </Text>
-
-            <View style={styles.locationGateStatus}>
-              <View style={styles.locationGateStatusRow}>
-                <MapPin size={17} color="#059669" />
-                <Text style={styles.locationGateStatusText}>
-                  {selectedCity !== 'كل المدن' && selectedDistrict !== 'كل الأحياء'
-                    ? `الموقع: ${selectedRegion} · ${selectedCity} · حي ${selectedDistrict}`
-                    : 'الموقع غير مكتمل'}
-                </Text>
-              </View>
-            </View>
-
-            {!!locationSetupMessage && <Text style={styles.locationGateMessage}>{locationSetupMessage}</Text>}
-
-            {selectedCity !== 'كل المدن' && selectedDistrict !== 'كل الأحياء' ? (
-              <Pressable style={styles.locationGatePrimary} onPress={enableRequiredNotifications} disabled={locationSetupBusy}>
-                {locationSetupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationGatePrimaryText}>تفعيل الإشعارات والمتابعة</Text>}
-              </Pressable>
-            ) : (
-              <Pressable style={styles.locationGatePrimary} onPress={setupRequiredLocation} disabled={locationSetupBusy}>
-                {locationSetupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationGatePrimaryText}>تحديد موقعي تلقائياً</Text>}
-              </Pressable>
-            )}
+      <WeeklyLocationPrompt
+        visible={loc.promptVisible && !loc.setupOpen}
+        onAllow={loc.acceptWeeklyCheck}
+        onLater={loc.snoozePrompt}
+      />
 
-            <Text style={styles.locationGateRequired}>تحديد الموقع مطلوب. الإشعارات يمكن تفعيلها الآن أو لاحقاً من الإعدادات.</Text>
-          </View>
-        </View>
-      </Modal>
-      <ScrollView 
+      <ScrollView
         style={styles.container}
         showsVerticalScrollIndicator={false}
+        keyboardShouldPersistTaps="handled"
         refreshControl={
-          <RefreshControl 
-            refreshing={refreshing} 
-            onRefresh={async () => { 
-              setRefreshing(true);
-              await load(); 
-              setRefreshing(false); 
-            }} 
+          <RefreshControl
+            refreshing={refreshing}
+            onRefresh={onRefresh}
             tintColor="#059669"
             colors={['#059669']}
             progressBackgroundColor="#ecfdf5"
           />
         }
       >
-        {/* ======================================================== */}
-        {/* 1. ULTRA-SLEEK MODERN HEADER                            */}
-        {/* ======================================================== */}
-        <LinearGradient 
-          colors={['#065f46', '#059669', '#10b981']} 
-          start={{ x: 0, y: 0 }} 
-          end={{ x: 1, y: 1 }}
-          style={styles.hero}
-        >
-          {/* Top Bar: Brand, Location Select, Weather & Notification + Avatar */}
-          <View style={styles.topNavRow}>
-            {/* Left side actions (Notifications & Profile Avatar) */}
-            <View style={styles.leftActions}>
-              <Pressable onPress={() => router.push('/profile')} style={styles.avatarWrap}>
-                {profile?.avatar_url ? (
-                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
-                ) : (
-                  <View style={styles.avatarPlaceholder}>
-                    <Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text>
-                  </View>
-                )}
-                {profile?.is_geoverified && (
-                  <View style={styles.avatarVerifiedBadge}>
-                    <ShieldCheck size={10} color="#fff" />
-                  </View>
-                )}
-              </Pressable>
-
-              <Pressable onPress={() => router.push('/notifications')} style={styles.iconCircleBtn}>
-                <Bell size={20} color="#fff" />
-                {unreadNotifCount > 0 && (
-                  <View style={styles.notifBadge}>
-                    <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
-                  </View>
-                )}
-              </Pressable>
-            </View>
-
-            {/* Right side: App Brand & Location Selector */}
-            <View style={styles.brandAndLocation}>
-              <View style={styles.brandTitleRow}>
-                <Image source={{ uri: logoUri }} style={styles.headerLogo} resizeMode="contain" />
-              </View>
-
-              {/* Location Selector Pill */}
-              <Pressable
-                style={styles.locationSelectorPill}
-                onPress={() => setShowLocationModal(true)}
-              >
-                <ChevronDown size={14} color="#a7f3d0" />
-                <Text style={styles.locationSelectorText} numberOfLines={1}>
-                  {selectedCity === 'كل المدن'
-                    ? 'كل مناطق المملكة'
-                    : `${selectedCity}${selectedDistrict !== 'كل الأحياء' ? ` · حي ${selectedDistrict}` : ''}`}
-                </Text>
-                <MapPin size={13} color="#6ee7b7" />
-              </Pressable>
-            </View>
-          </View>
-
-          {/* Search Bar */}
-          <View style={styles.searchBarContainer}>
-            <View style={styles.searchBar}>
-              <Search size={20} color="#94a3b8" />
-              <TextInput 
-                placeholder="ابحث عن استفسار أو طلب أو اسم جار..."
-                placeholderTextColor="#94a3b8"
-                style={styles.searchInput}
-                accessibilityLabel="البحث في الاستفسارات والطلبات وأسماء الجيران"
-                value={searchQuery}
-                onChangeText={setSearchQuery}
-                returnKeyType="search"
-              />
-              {searchQuery.length > 0 ? (
-                <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn} accessibilityRole="button" accessibilityLabel="مسح البحث">
-                  <X size={17} color="#64748b" />
-                </Pressable>
-              ) : (
-                <Pressable style={styles.micBtn} onPress={() => router.push('/questions')}>
-                  <Mic size={17} color="#059669" />
-                </Pressable>
-              )}
-            </View>
-          </View>
-        </LinearGradient>
-
-        {/* ======================================================== */}
-        {/* 1.5 LIVE NEIGHBORHOOD ATMOSPHERE BAR (أجواء ونبض الحي)     */}
-        {/* ======================================================== */}
-        <View style={styles.atmosphereBar}>
-          <View style={styles.atmoItem}>
-            <CloudSun size={15} color="#059669" />
-            <Text style={styles.atmoText} numberOfLines={1}>
-              {currentWeather ? `${Math.round(currentWeather.temperature)}°C · ${describeWeatherCode(currentWeather.weatherCode)} · ${currentWeather.locationName}` : weatherLoading ? 'جارٍ جلب الطقس الحالي...' : 'الطقس غير متاح حالياً'}
-            </Text>
-          </View>
-          <View style={styles.atmoDivider} />
-          <View style={styles.atmoItem}>
-            <Flame size={15} color="#f59e0b" />
-            <Text style={styles.atmoText}>42 جار نشط الآن</Text>
-          </View>
-          <View style={styles.atmoDivider} />
-          <View style={styles.atmoItem}>
-            <ShieldCheck size={15} color="#059669" />
-            <Text style={styles.atmoText}>حي آمن ومترابط</Text>
-          </View>
-        </View>
-
-        {/* ======================================================== */}
-        {/* 2. NEIGHBORHOOD STORIES (يوميات ومحطات الحي الفخمة)        */}
-        {/* ======================================================== */}
-        <View style={styles.storiesContainer}>
-          {/* Stories Header Row */}
-          <View style={styles.storiesHeaderRow}>
-            <Pressable 
-              style={styles.publishStoryHeaderBtn} 
-              onPress={() => router.push('/create-story')}
-            >
-              <Plus size={14} color="#059669" />
-              <Text style={styles.publishStoryHeaderText}>نشر يوميات</Text>
-            </Pressable>
-
-            <View style={styles.storiesTitleRow}>
-              <View style={styles.storiesLiveBadge}>
-                <View style={styles.storiesLivePulseDot} />
-                <Text style={styles.storiesLiveText}>مباشر 24س</Text>
-              </View>
-              <Text style={styles.storiesSectionTitle}>يوميات الحي</Text>
-            </View>
-          </View>
-
-          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
-            {/* User's Story Item */}
-            <Pressable style={styles.storyBox} onPress={() => router.push('/create-story')}>
-              <LinearGradient 
-                colors={['#059669', '#10b981', '#34d399']} 
-                style={styles.storyAddRing} 
-                start={{ x: 0, y: 0 }} 
-                end={{ x: 1, y: 1 }}
-              >
-                <View style={styles.storyInnerBorder}>
-                  {profile?.avatar_url ? (
-                    <Image source={{ uri: profile.avatar_url }} style={styles.storyImg} />
-                  ) : (
-                    <View style={styles.storySelfPlaceholder}>
-                      <Camera size={20} color="#059669" />
-                    </View>
-                  )}
-                  <View style={styles.storySelfPlusBadge}>
-                    <Plus size={11} color="#fff" strokeWidth={3} />
-                  </View>
-                </View>
-              </LinearGradient>
-              <Text style={styles.storyName}>أضف يومياتك</Text>
-              <Text style={styles.storyDistrictSub}>قصتك أنت</Text>
-            </Pressable>
-
-            {/* Real Stories from DB */}
-            {stories.map((story) => {
-              const authorName = story.profiles?.display_name || story.profiles?.username || 'جار';
-              const avatarUrl = story.profiles?.avatar_url;
-              const isVerified = story.profiles?.is_verified;
-              const isGeoVerified = story.profiles?.is_geoverified;
-              return (
-                <Pressable 
-                  key={story.id} 
-                  style={styles.storyBox} 
-                  onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
-                >
-                  <LinearGradient 
-                    colors={['#059669', '#10b981', '#3b82f6']} 
-                    style={styles.storyGradientRing}
-                    start={{ x: 0, y: 0 }} 
-                    end={{ x: 1, y: 1 }}
-                  >
-                    <View style={styles.storyInnerBorder}>
-                      {story.type === 'text' ? (
-                        <View style={[styles.storyTextPreview, { backgroundColor: story.bg_color || '#059669' }]}>
-                          <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>
-                            {story.content?.[0] || 'ق'}
-                          </Text>
-                        </View>
-                      ) : avatarUrl ? (
-                        <Image source={{ uri: avatarUrl }} style={styles.storyImg} />
-                      ) : (
-                        <View style={[styles.storyTextPreview, { backgroundColor: story.bg_color || '#059669' }]}>
-                          <Text style={styles.storyTextPreviewLetter}>{authorName[0]}</Text>
-                        </View>
-                      )}
-                    </View>
-                    {(isVerified || isGeoVerified) && (
-                      <View style={styles.storyVerifiedTag}>
-                        <ShieldCheck size={9} color="#fff" />
-                      </View>
-                    )}
-                  </LinearGradient>
-                  <Text style={styles.storyName} numberOfLines={1}>{authorName}</Text>
-                  <Text style={styles.storyDistrictSub} numberOfLines={1}>
-                    {selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'جار الحي'}
-                  </Text>
-                </Pressable>
-              );
-            })}
-
-          </ScrollView>
-        </View>
-
-        {/* ======================================================== */}
-        {/* 4. EMERGENCY SOS BANNER (Live Urgent Neighborhood Alert) */}
-        {/* ======================================================== */}
-        {emergencyQuestions.length > 0 && (
+        <HomeHero
+          profile={feed.profile}
+          logoUri={logoUri}
+          greeting={greeting}
+          unreadCount={feed.unreadNotifCount}
+          city={loc.city}
+          district={loc.district}
+          searchQuery={searchQuery}
+          onSearchChange={setSearchQuery}
+          onOpenLocation={() => setShowLocationModal(true)}
+        />
+
+        <AtmosphereBar
+          weather={loc.weather}
+          weatherLoading={loc.weatherLoading}
+          activeNeighbors={activeNeighbors}
+          emergencyCount={derived.emergency.length}
+        />
+
+        <StoriesRow profile={feed.profile} stories={feed.stories} selectedDistrict={loc.district} />
+
+        {emergencyTop && (
           <View style={styles.emergencyHomeCard}>
             <View style={styles.emergencyHomeHeader}>
               <View style={styles.emergencyLiveBadge}>
@@ -721,1089 +257,108 @@ export default function Home() {
               </View>
             </View>
             <Pressable
-              onPress={() => router.push({ pathname: '/question', params: { id: emergencyQuestions[0].id } })}
+              onPress={() => router.push({ pathname: '/question', params: { id: emergencyTop.id } })}
               style={styles.emergencyContentBox}
+              accessibilityRole="button"
+              accessibilityLabel={`بلاغ طارئ: ${emergencyTop.title}`}
             >
-              <Text style={styles.emergencyQuestionTitle}>{emergencyQuestions[0].title}</Text>
+              <Text style={styles.emergencyQuestionTitle}>{emergencyTop.title}</Text>
               <Text style={styles.emergencyQuestionSub}>اضغط للتفاصيل والمساعدة الفورية من أهل الحي ←</Text>
             </Pressable>
           </View>
         )}
 
-        {/* ======================================================== */}
-        {/* 5. QUICK SERVICES GRID (خدمات وفزعة الحي)                */}
-        {/* ======================================================== */}
-        <View style={styles.servicesGrid}>
-          <ServicePill 
-            icon={<MessageCircle size={22} color="#059669" />} 
-            bg="#ecfdf5" 
-            label="اسأل الحي" 
-            badge="فوري"
-            badgeBg="#059669"
-            onPress={() => router.push('/ask')} 
-          />
-          <ServicePill 
-            icon={<Camera size={22} color="#8b5cf6" />} 
-            bg="#f5f3ff" 
-            label="يوميات الحي" 
-            badge="24 ساعة"
-            badgeBg="#7c3aed"
-            onPress={() => router.push('/create-story')} 
-          />
-          <ServicePill 
-            icon={<Wrench size={22} color="#16a34a" />} 
-            bg="#f0fdf4" 
-            label="إعارة أدوات" 
-            badge="مجاني"
-            badgeBg="#16a34a"
-            onPress={() => {
-              setActiveTab('tools');
-              showToast('أدوات ومعدات متاحة للإعارة بين الجيران');
-            }} 
-          />
-          <ServicePill 
-            icon={<Briefcase size={22} color="#0284c7" />} 
-            bg="#f0f9ff" 
-            label="خدمات الحي" 
-            badge="مهنيون"
-            badgeBg="#0284c7"
-            onPress={() => router.push('/services')} 
-          />
-          <ServicePill 
-            icon={<Truck size={22} color="#d97706" />} 
-            bg="#fffbeb" 
-            label="فزعة وطلبات" 
-            badge="تعاون"
-            badgeBg="#d97706"
-            onPress={() => router.push('/requests')} 
-          />
-          <ServicePill 
-            icon={<Map size={22} color="#059669" />} 
-            bg="#ecfdf5" 
-            label="خريطة الحي" 
-            badge="مباشر"
-            badgeBg="#059669"
-            onPress={() => router.push('/map')} 
-          />
-        </View>
-
+        <ServicesGrid
+          onTools={() => {
+            setActiveTab('tools');
+            showToast('أدوات ومعدات متاحة للإعارة بين الجيران');
+          }}
+        />
 
-
-        {/* ======================================================== */}
-        {/* 6. COMMUNITY FEED SECTION & TABS                        */}
-        {/* ======================================================== */}
         <View style={styles.feedSection}>
-          {/* Twitter-style Filter Pills */}
-          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingTabs}>
-            <Pressable 
-              style={[styles.fTab, activeTab === 'all' && styles.fTabActive]} 
-              onPress={() => setActiveTab('all')}
-            >
-              <View style={styles.fTabLabelRow}>
-                <Map size={15} color={activeTab === 'all' ? '#fff' : '#475569'} />
-                <Text style={[styles.fTabText, activeTab === 'all' && styles.fTabTextActive]}>الكل</Text>
-              </View>
-            </Pressable>
-
-            {/* My posts filter */}
-            <Pressable 
-              style={[styles.fTab, activeTab === 'mine' && styles.fTabActiveMine]} 
-              onPress={() => setActiveTab('mine')}
-            >
-              <View style={styles.fTabLabelRow}>
-                <User size={15} color={activeTab === 'mine' ? '#fff' : '#475569'} />
-                <Text style={[styles.fTabText, activeTab === 'mine' && styles.fTabTextActive]}>منشوراتي ({myQuestions.length + myRequests.length})</Text>
-              </View>
-            </Pressable>
-
-            {emergencyQuestions.length > 0 && (
-              <Pressable 
-                style={[styles.fTab, activeTab === 'emergency' && styles.fTabActiveRed]} 
-                onPress={() => setActiveTab('emergency')}
-              >
-                <View style={styles.fTabLabelRow}>
-                  <Flame size={15} color={activeTab === 'emergency' ? '#fff' : '#475569'} />
-                  <Text style={[styles.fTabText, activeTab === 'emergency' && styles.fTabTextActive]}>طوارئ ({emergencyQuestions.length})</Text>
-                </View>
-              </Pressable>
-            )}
-
-            <Pressable 
-              style={[styles.fTab, activeTab === 'tools' && styles.fTabActiveGreen]} 
-              onPress={() => setActiveTab('tools')}
-            >
-              <View style={styles.fTabLabelRow}>
-                <Wrench size={15} color={activeTab === 'tools' ? '#fff' : '#475569'} />
-                <Text style={[styles.fTabText, activeTab === 'tools' && styles.fTabTextActive]}>إعارة ({toolQuestions.length})</Text>
-              </View>
-            </Pressable>
+          <FeedTabs
+            activeTab={activeTab}
+            onChange={setActiveTab}
+            counts={{
+              mine: derived.myCount,
+              emergency: derived.emergency.length,
+              tools: derived.tools.length,
+              questions: derived.filteredQuestions.length,
+              requests: derived.filteredRequests.length,
+            }}
+          />
 
-            <Pressable 
-              style={[styles.fTab, activeTab === 'questions' && styles.fTabActive]} 
-              onPress={() => setActiveTab('questions')}
-            >
-              <View style={styles.fTabLabelRow}>
-                <MessageCircle size={15} color={activeTab === 'questions' ? '#fff' : '#475569'} />
-                <Text style={[styles.fTabText, activeTab === 'questions' && styles.fTabTextActive]}>استفسارات ({filteredQuestions.length})</Text>
-              </View>
-            </Pressable>
+          {feed.error && <ErrorBanner message={feed.error} onRetry={feed.reload} />}
+
+          {feed.loading ? (
+            <FeedSkeleton />
+          ) : items.length === 0 ? (
+            <EmptyState tab={activeTab} searching={searching} city={loc.city} hasExactLocation={loc.hasExactLocation} />
+          ) : (
+            items.map(item => (
+              <TwitterInquiryCard
+                key={`${activeTab}-${item.type}-${item.data.id}`}
+                type={item.type}
+                data={item.data}
+                currentUserProfile={feed.profile}
+                currentUserId={feed.currentUserId}
+                isMine={activeTab === 'mine' ? true : undefined}
+                onQuickReply={handleQuickReply}
+                onToast={showToast}
+              />
+            ))
+          )}
 
-            <Pressable 
-              style={[styles.fTab, activeTab === 'requests' && styles.fTabActive]} 
-              onPress={() => setActiveTab('requests')}
+          {!feed.loading && feed.hasMore && items.length > 0 && (
+            <Pressable
+              style={styles.loadMoreBtn}
+              onPress={feed.loadMore}
+              disabled={feed.loadingMore}
+              accessibilityRole="button"
+              accessibilityLabel="تحميل المزيد"
             >
-              <View style={styles.fTabLabelRow}>
-                <Truck size={15} color={activeTab === 'requests' ? '#fff' : '#475569'} />
-                <Text style={[styles.fTabText, activeTab === 'requests' && styles.fTabTextActive]}>فزعة ({filteredRequests.length})</Text>
-              </View>
+              {feed.loadingMore ? (
+                <ActivityIndicator color="#059669" />
+              ) : (
+                <Text style={styles.loadMoreText}>عرض المزيد</Text>
+              )}
             </Pressable>
-          </ScrollView>
-
-          {/* Render Twitter-Style Progressive Feed */}
-          {activeTab === 'all' && (
-            [
-              ...filteredQuestions.map(q => ({ type: 'question' as const, data: q })),
-              ...filteredRequests.map(r => ({ type: 'request' as const, data: r }))
-            ]
-              .sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
-              .map(item => (
-                <TwitterInquiryCard 
-                  key={`${item.type}-${item.data.id}`} 
-                  type={item.type} 
-                  data={item.data} 
-                  currentUserProfile={profile}
-                  currentUserId={currentUserId}
-                  onQuickReply={handleQuickReplySubmit}
-                  onToast={showToast}
-                />
-              ))
-          )}
-
-          {activeTab === 'emergency' && emergencyQuestions.map(q => (
-            <TwitterInquiryCard 
-              key={`em-${q.id}`} 
-              type="question" 
-              data={q} 
-              currentUserProfile={profile}
-              currentUserId={currentUserId}
-              onQuickReply={handleQuickReplySubmit}
-              onToast={showToast}
-            />
-          ))}
-
-          {activeTab === 'tools' && toolQuestions.map(q => (
-            <TwitterInquiryCard 
-              key={`tool-${q.id}`} 
-              type="question" 
-              data={q} 
-              currentUserProfile={profile}
-              currentUserId={currentUserId}
-              onQuickReply={handleQuickReplySubmit}
-              onToast={showToast}
-            />
-          ))}
-
-          {activeTab === 'questions' && filteredQuestions.map(q => (
-            <TwitterInquiryCard 
-              key={`q-${q.id}`} 
-              type="question" 
-              data={q} 
-              currentUserProfile={profile}
-              currentUserId={currentUserId}
-              onQuickReply={handleQuickReplySubmit}
-              onToast={showToast}
-            />
-          ))}
-
-          {activeTab === 'requests' && filteredRequests.map(r => (
-            <TwitterInquiryCard 
-              key={`r-${r.id}`} 
-              type="request" 
-              data={r} 
-              currentUserProfile={profile}
-              currentUserId={currentUserId}
-              onQuickReply={handleQuickReplySubmit}
-              onToast={showToast}
-            />
-          ))}
-
-          {/* My Posts Tab */}
-          {activeTab === 'mine' && (
-            [
-              ...filteredMyQuestions.map(q => ({ type: 'question' as const, data: q })),
-              ...filteredMyRequests.map(r => ({ type: 'request' as const, data: r }))
-            ]
-              .sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
-              .map(item => (
-                <TwitterInquiryCard 
-                  key={`mine-${item.type}-${item.data.id}`} 
-                  type={item.type} 
-                  data={item.data} 
-                  currentUserProfile={profile}
-                  currentUserId={currentUserId}
-                  isMine={true}
-                  onQuickReply={handleQuickReplySubmit}
-                  onToast={showToast}
-                />
-              ))
-          )}
-
-          {activeTab === 'mine' && filteredMyQuestions.length === 0 && filteredMyRequests.length === 0 && (
-            <View style={styles.emptyContainer}>
-              <View style={styles.emptyIconBg}>
-                <User size={36} color="#059669" />
-              </View>
-              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد منشورات تطابق البحث' : 'لا توجد منشورات بعد'}</Text>
-              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمة أخرى أو امسح البحث.' : 'استفساراتك وطلباتك ستظهر هنا عند نشرها في الحي.'}</Text>
-              {!normalizedSearch && <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
-                <Text style={styles.emptyAskBtnText}>انشر أول استفسار لك</Text>
-              </Pressable>}
-            </View>
-          )}
-
-          {/* Empty States */}
-          {activeTab === 'all' && filteredQuestions.length === 0 && filteredRequests.length === 0 && (
-            <View style={styles.emptyContainer}>
-              <View style={styles.emptyIconBg}>
-                <Sparkles size={36} color="#059669" />
-              </View>
-              <Text style={styles.emptyTitle}>
-                {normalizedSearch ? 'لا توجد نتائج مطابقة للبحث' : selectedCity === 'كل المدن' ? 'لا توجد استفسارات حالياً' : `لا توجد استفسارات في ${selectedCity} حالياً`}
-              </Text>
-              <Text style={styles.emptySub}>
-                {normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث لعرض جميع المنشورات.' : 'كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك بأسلوب خيط المحادثات.'}
-              </Text>
-              <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
-                <Text style={styles.emptyAskBtnText}>اسأل أهل حيك الآن</Text>
-              </Pressable>
-            </View>
-          )}
-
-          {activeTab === 'emergency' && emergencyQuestions.length === 0 && (
-            <View style={styles.emptyContainer}>
-              <View style={styles.emptyIconBg}>
-                <ShieldCheck size={36} color="#16a34a" />
-              </View>
-              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد نتائج طوارئ مطابقة' : 'الحمد لله، لا توجد طوارئ'}</Text>
-              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'الحي آمن ومستقر بفضل الله.'}</Text>
-            </View>
-          )}
-
-          {activeTab === 'tools' && toolQuestions.length === 0 && (
-            <View style={styles.emptyContainer}>
-              <View style={styles.emptyIconBg}>
-                <Wrench size={36} color="#16a34a" />
-              </View>
-              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد عروض إعارة مطابقة' : 'لا توجد عروض إعارة حالياً'}</Text>
-              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟'}</Text>
-              {!normalizedSearch && <Pressable style={[styles.emptyAskBtn, { backgroundColor: '#16a34a' }]} onPress={() => router.push('/ask')}>
-                <Text style={styles.emptyAskBtnText}>اعرض أداة للإعارة المجانية</Text>
-              </Pressable>}
-            </View>
-          )}
-
-          {activeTab === 'questions' && filteredQuestions.length === 0 && (
-            <View style={styles.emptyContainer}>
-              <View style={styles.emptyIconBg}>
-                <MessageCircle size={36} color="#059669" />
-              </View>
-              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد استفسارات مطابقة' : 'لا توجد استفسارات حالياً'}</Text>
-              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'اطرح سؤالك الأول لأهل الحي وتلقى ردوداً وتوصيات مجربة.'}</Text>
-              {!normalizedSearch && <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
-                <Text style={styles.emptyAskBtnText}>اطرح سؤالك الآن</Text>
-              </Pressable>}
-            </View>
-          )}
-
-          {activeTab === 'requests' && filteredRequests.length === 0 && (
-            <View style={styles.emptyContainer}>
-              <View style={styles.emptyIconBg}>
-                <Truck size={36} color="#d97706" />
-              </View>
-              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات فزعة حالياً'}</Text>
-              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'شارك جيرانك أي مساعدة تحتاجها وسيقف أهل حيك بجانبك.'}</Text>
-            </View>
           )}
 
           <View style={{ height: 130 }} />
         </View>
       </ScrollView>
 
-      {/* Floating Ask Button (above bottom nav) */}
       <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
-        <Pressable style={styles.fabBtn} onPress={() => router.push('/ask')}>
-          <LinearGradient colors={['#065f46', '#059669', '#10b981']} style={styles.fabGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
+        <Pressable
+          style={styles.fabBtn}
+          onPress={() => router.push('/ask')}
+          accessibilityRole="button"
+          accessibilityLabel="اسأل أهل حيك"
+        >
+          <LinearGradient
+            colors={['#065f46', '#059669', '#10b981']}
+            style={styles.fabGrad}
+            start={{ x: 0, y: 0 }}
+            end={{ x: 1, y: 1 }}
+          >
             <Plus size={20} color="#fff" />
             <Text style={styles.fabText}>اسأل أهل حيك</Text>
           </LinearGradient>
         </Pressable>
       </Animated.View>
 
-      {/* Bottom Navigation */}
       <View style={styles.bottomNavWrapper}>
         <BottomNav />
       </View>
 
-      {/* Saudi Regions & Districts Selector Modal */}
       <LocationSelectorModal
         visible={showLocationModal}
         onClose={() => setShowLocationModal(false)}
-        selectedCity={selectedCity}
-        selectedDistrict={selectedDistrict}
-        onSelect={(region, city, district) => {
-          setSelectedRegion(region);
-          setSelectedCity(city);
-          setSelectedDistrict(district);
-          if (!region || !city || !district || city === 'كل المدن' || district === 'كل الأحياء' || district === 'كل أحياء المدينة') {
-            showToast('حدد المنطقة والمدينة والحي لإكمال موقعك');
-            return;
-          }
-          void savePermanentMyLocation({ region, city, district }, true);
-        }}
+        selectedCity={loc.city}
+        selectedDistrict={loc.district}
+        onSelect={handleLocationSelect}
       />
     </View>
   );
 }
-
-// ========================================================
-// HELPER COMPONENTS
-// ========================================================
-
-function normalizeSearchText(value: unknown): string {
-  return String(value ?? '')
-    .normalize('NFKD')
-    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
-    .replace(/[أإآٱ]/g, 'ا')
-    .replace(/ى/g, 'ي')
-    .replace(/ة/g, 'ه')
-    .toLocaleLowerCase('ar')
-    .trim()
-    .replace(/\s+/g, ' ');
-}
-
-function ServicePill({
-  icon,
-  bg,
-  label,
-  badge,
-  badgeBg,
-  onPress,
-}: {
-  icon: any;
-  bg: string;
-  label: string;
-  badge?: string;
-  badgeBg?: string;
-  onPress?: () => void;
-}) {
-  return (
-    <Pressable style={styles.servicePill} onPress={onPress}>
-      <View style={[styles.serviceIconBox, { backgroundColor: bg }]}>
-        {icon}
-        {badge ? (
-          <View style={[styles.servicePillBadge, badgeBg ? { backgroundColor: badgeBg } : {}]}>
-            <Text style={styles.servicePillBadgeText}>{badge}</Text>
-          </View>
-        ) : null}
-      </View>
-      <Text style={styles.serviceLabel} numberOfLines={1}>{label}</Text>
-    </Pressable>
-  );
-}
-
-// ========================================================
-// STYLESHEET
-// ========================================================
-
-const styles = StyleSheet.create({
-  locationPromptBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24 },
-  locationPromptCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 22, alignItems: 'center' },
-  locationPromptTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#064e3b', textAlign: 'center' },
-  locationPromptText: { marginTop: 8, fontSize: 13, lineHeight: 21, color: '#475569', textAlign: 'center' },
-  locationPromptActions: { width: '100%', flexDirection: 'row-reverse', gap: 10, marginTop: 18 },
-  locationPromptAllow: { flex: 1, backgroundColor: '#059669', borderRadius: 14, padding: 13, alignItems: 'center' },
-  locationPromptAllowText: { color: '#fff', fontWeight: '900' },
-  locationPromptLater: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 14, padding: 13, alignItems: 'center' },
-  locationPromptLaterText: { color: '#475569', fontWeight: '900' },
-  container: {
-    flex: 1,
-    backgroundColor: '#f8fafc',
-  },
-  hero: {
-    paddingTop: Platform.OS === 'ios' ? 52 : 38,
-    paddingBottom: 22,
-    borderBottomLeftRadius: 32,
-    borderBottomRightRadius: 32,
-    shadowColor: '#059669',
-    shadowOffset: { width: 0, height: 8 },
-    shadowOpacity: 0.2,
-    shadowRadius: 16,
-    elevation: 8,
-  },
-  topNavRow: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    justifyContent: 'space-between',
-    paddingHorizontal: 20,
-    marginBottom: 16,
-  },
-  brandAndLocation: {
-    alignItems: 'flex-end',
-  },
-  brandTitleRow: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    gap: 6,
-    marginBottom: 4,
-  },
-  headerLogo: {
-    width: 38,
-    height: 38,
-    marginLeft: 7,
-  },
-  locationSelectorPill: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    backgroundColor: 'rgba(255,255,255,0.22)',
-    paddingHorizontal: 10,
-    paddingVertical: 4,
-    borderRadius: 20,
-    gap: 5,
-    borderWidth: 1,
-    borderColor: 'rgba(255,255,255,0.35)',
-  },
-  locationSelectorText: {
-    color: '#fff',
-    fontSize: 11,
-    fontWeight: '800',
-    maxWidth: 200,
-  },
-  leftActions: {
-    flexDirection: 'row',
-    alignItems: 'center',
-    gap: 10,
-  },
-  avatarWrap: {
-    position: 'relative',
-  },
-  avatarImg: {
-    width: 44,
-    height: 44,
-    borderRadius: 22,
-    borderWidth: 2,
-    borderColor: '#fff',
-  },
-  avatarPlaceholder: {
-    width: 44,
-    height: 44,
-    borderRadius: 22,
-    backgroundColor: 'rgba(255,255,255,0.25)',
-    justifyContent: 'center',
-    alignItems: 'center',
-    borderWidth: 2,
-    borderColor: '#fff',
-  },
-  avatarLetter: {
-    color: '#fff',
-    fontSize: 18,
-    fontWeight: '900',
-  },
-  avatarVerifiedBadge: {
-    position: 'absolute',
-    bottom: -2,
-    right: -2,
-    width: 16,
-    height: 16,
-    borderRadius: 8,
-    backgroundColor: '#16a34a',
-    justifyContent: 'center',
-    alignItems: 'center',
-    borderWidth: 1.5,
-    borderColor: '#fff',
-  },
-  iconCircleBtn: {
-    width: 40,
-    height: 40,
-    borderRadius: 20,
-    backgroundColor: 'rgba(255,255,255,0.2)',
-    justifyContent: 'center',
-    alignItems: 'center',
-    borderWidth: 1,
-    borderColor: 'rgba(255,255,255,0.3)',
-    position: 'relative',
-  },
-  notifBadge: {
-    position: 'absolute',
-    top: -2,
-    right: -2,
-    backgroundColor: '#ef4444',
-    borderRadius: 10,
-    minWidth: 18,
-    height: 18,
-    alignItems: 'center',
-    justifyContent: 'center',
-    paddingHorizontal: 3,
-    borderWidth: 1.5,
-    borderColor: '#fff',
-  },
-  notifBadgeText: {
-    color: '#fff',
-    fontSize: 10,
-    fontWeight: '900',
-  },
-  searchBarContainer: {
-    paddingHorizontal: 20,
-  },
-  searchBar: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    backgroundColor: '#fff',
-    borderRadius: 16,
-    paddingHorizontal: 14,
-    height: 48,
-    shadowColor: '#000',
-    shadowOffset: { width: 0, height: 3 },
-    shadowOpacity: 0.1,
-    shadowRadius: 6,
-    elevation: 3,
-    gap: 8,
-  },
-  searchInput: {
-    flex: 1,
-    fontSize: 13,
-    color: '#0f172a',
-    textAlign: 'right',
-  },
-  micBtn: {
-    padding: 6,
-  },
-  clearSearchBtn: {
-    padding: 6,
-  },
-  // Atmosphere & Neighborhood Pulse Bar
-  atmosphereBar: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    justifyContent: 'space-around',
-    backgroundColor: '#fff',
-    marginHorizontal: 16,
-    marginTop: -14,
-    marginBottom: 12,
-    borderRadius: 18,
-    paddingVertical: 10,
-    paddingHorizontal: 14,
-    shadowColor: '#000',
-    shadowOffset: { width: 0, height: 3 },
-    shadowOpacity: 0.06,
-    shadowRadius: 8,
-    elevation: 3,
-    borderWidth: 1,
-    borderColor: '#f1f5f9',
-    zIndex: 10,
-  },
-  atmoItem: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    gap: 6,
-  },
-  atmoText: {
-    fontSize: 11,
-    fontWeight: '800',
-    color: '#334155',
-  },
-  atmoDivider: {
-    width: 1,
-    height: 16,
-    backgroundColor: '#e2e8f0',
-  },
-
-  // Upgraded Stories Section
-  storiesContainer: {
-    paddingVertical: 14,
-    backgroundColor: '#fff',
-    borderBottomWidth: 1,
-    borderBottomColor: '#f1f5f9',
-  },
-  storiesHeaderRow: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    justifyContent: 'space-between',
-    paddingHorizontal: 16,
-    marginBottom: 12,
-  },
-  storiesTitleRow: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    gap: 8,
-  },
-  storiesSectionTitle: {
-    fontSize: 14,
-    fontWeight: '900',
-    color: '#0f172a',
-  },
-  storiesLiveBadge: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    backgroundColor: '#ecfdf5',
-    paddingHorizontal: 7,
-    paddingVertical: 2.5,
-    borderRadius: 10,
-    borderWidth: 1,
-    borderColor: '#a7f3d0',
-    gap: 4,
-  },
-  storiesLivePulseDot: {
-    width: 6,
-    height: 6,
-    borderRadius: 3,
-    backgroundColor: '#10b981',
-  },
-  storiesLiveText: {
-    fontSize: 9.5,
-    fontWeight: '800',
-    color: '#059669',
-  },
-  publishStoryHeaderBtn: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    backgroundColor: '#f0fdf4',
-    paddingHorizontal: 10,
-    paddingVertical: 4.5,
-    borderRadius: 14,
-    borderWidth: 1,
-    borderColor: '#bbf7d0',
-    gap: 4,
-  },
-  publishStoryHeaderText: {
-    fontSize: 11,
-    fontWeight: '800',
-    color: '#059669',
-  },
-  storiesScroll: {
-    paddingHorizontal: 16,
-    gap: 14,
-    alignItems: 'flex-start',
-  },
-  storyBox: {
-    alignItems: 'center',
-    width: 68,
-  },
-  storyAddRing: {
-    width: 66,
-    height: 66,
-    borderRadius: 33,
-    padding: 2.5,
-    justifyContent: 'center',
-    alignItems: 'center',
-    marginBottom: 5,
-  },
-  storyGradientRing: {
-    width: 66,
-    height: 66,
-    borderRadius: 33,
-    padding: 2.5,
-    justifyContent: 'center',
-    alignItems: 'center',
-    marginBottom: 5,
-    position: 'relative',
-  },
-  storyInnerBorder: {
-    width: '100%',
-    height: '100%',
-    borderRadius: 31,
-    borderWidth: 2,
-    borderColor: '#fff',
-    overflow: 'hidden',
-    justifyContent: 'center',
-    alignItems: 'center',
-    backgroundColor: '#f8fafc',
-    position: 'relative',
-  },
-  storySelfPlaceholder: {
-    width: '100%',
-    height: '100%',
-    backgroundColor: '#ecfdf5',
-    justifyContent: 'center',
-    alignItems: 'center',
-  },
-  storySelfPlusBadge: {
-    position: 'absolute',
-    bottom: 0,
-    right: 0,
-    backgroundColor: '#059669',
-    width: 20,
-    height: 20,
-    borderRadius: 10,
-    justifyContent: 'center',
-    alignItems: 'center',
-    borderWidth: 2,
-    borderColor: '#fff',
-  },
-  storyImg: {
-    width: '100%',
-    height: '100%',
-    borderRadius: 30,
-  },
-  storyTextPreview: {
-    width: '100%',
-    height: '100%',
-    borderRadius: 30,
-    justifyContent: 'center',
-    alignItems: 'center',
-  },
-  storyTextPreviewLetter: {
-    color: '#fff',
-    fontSize: 22,
-    fontWeight: '900',
-  },
-  storyVerifiedTag: {
-    position: 'absolute',
-    bottom: -1,
-    right: -1,
-    width: 18,
-    height: 18,
-    borderRadius: 9,
-    backgroundColor: '#16a34a',
-    justifyContent: 'center',
-    alignItems: 'center',
-    borderWidth: 1.5,
-    borderColor: '#fff',
-  },
-  storyName: {
-    fontSize: 11,
-    fontWeight: '800',
-    color: '#0f172a',
-    textAlign: 'center',
-  },
-  storyDistrictSub: {
-    fontSize: 9.5,
-    color: '#64748b',
-    fontWeight: '600',
-    textAlign: 'center',
-    marginTop: 1,
-  },
-
-  // Service Pill Badges
-  servicePillBadge: {
-    position: 'absolute',
-    top: -5,
-    right: -6,
-    backgroundColor: '#059669',
-    paddingHorizontal: 4,
-    paddingVertical: 1,
-    borderRadius: 8,
-    borderWidth: 1.5,
-    borderColor: '#fff',
-    zIndex: 5,
-  },
-  servicePillBadgeText: {
-    color: '#fff',
-    fontSize: 7.5,
-    fontWeight: '900',
-  },
-  emergencyHomeCard: {
-    marginHorizontal: 16,
-    marginTop: 12,
-    backgroundColor: '#fef2f2',
-    borderRadius: 18,
-    padding: 14,
-    borderWidth: 2,
-    borderColor: '#fca5a5',
-  },
-  emergencyHomeHeader: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    justifyContent: 'space-between',
-    marginBottom: 6,
-  },
-  emergencyHomeTitle: {
-    fontSize: 13,
-    fontWeight: '900',
-    color: '#dc2626',
-  },
-  emergencyLiveBadge: {
-    backgroundColor: '#dc2626',
-    paddingHorizontal: 7,
-    paddingVertical: 2,
-    borderRadius: 6,
-  },
-  emergencyLiveText: {
-    color: '#fff',
-    fontSize: 9,
-    fontWeight: '900',
-  },
-  emergencyContentBox: {
-    backgroundColor: '#fff',
-    borderRadius: 12,
-    padding: 10,
-    borderWidth: 1,
-    borderColor: '#fecaca',
-  },
-  emergencyQuestionTitle: {
-    fontSize: 13,
-    fontWeight: '900',
-    color: '#991b1b',
-    textAlign: 'right',
-  },
-  emergencyQuestionSub: {
-    fontSize: 11,
-    color: '#dc2626',
-    textAlign: 'right',
-    marginTop: 3,
-  },
-  servicesGrid: {
-    flexDirection: 'row-reverse',
-    justifyContent: 'space-between',
-    paddingHorizontal: 16,
-    marginTop: 14,
-    marginBottom: 8,
-  },
-  servicePill: {
-    alignItems: 'center',
-    width: (width - 48) / 6,
-  },
-  serviceIconBox: {
-    width: 44,
-    height: 44,
-    borderRadius: 14,
-    justifyContent: 'center',
-    alignItems: 'center',
-    marginBottom: 5,
-    shadowColor: '#000',
-    shadowOffset: { width: 0, height: 2 },
-    shadowOpacity: 0.05,
-    shadowRadius: 4,
-    elevation: 1,
-  },
-  serviceLabel: {
-    fontSize: 10,
-    fontWeight: '700',
-    color: '#334155',
-    textAlign: 'center',
-  },
-  feedSection: {
-    marginTop: 12,
-    paddingHorizontal: 16,
-  },
-  floatingTabs: {
-    flexDirection: 'row-reverse',
-    gap: 8,
-    marginBottom: 14,
-    paddingVertical: 4,
-  },
-  fTab: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    gap: 6,
-    paddingHorizontal: 14,
-    paddingVertical: 8,
-    borderRadius: 20,
-    backgroundColor: '#fff',
-    borderWidth: 1.5,
-    borderColor: '#e2e8f0',
-  },
-  fTabActive: {
-    backgroundColor: '#059669',
-    borderColor: '#059669',
-  },
-  fTabActiveRed: {
-    backgroundColor: '#dc2626',
-    borderColor: '#dc2626',
-  },
-  fTabActiveGreen: {
-    backgroundColor: '#16a34a',
-    borderColor: '#16a34a',
-  },
-  fTabActiveMine: {
-    backgroundColor: '#7c3aed',
-    borderColor: '#7c3aed',
-  },
-  fTabText: {
-    fontSize: 12,
-    fontWeight: '800',
-    color: '#475569',
-  },
-  fTabLabelRow: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    gap: 6,
-  },
-  fTabTextActive: {
-    color: '#fff',
-  },
-  // Empty state & FAB
-  emptyContainer: {
-    alignItems: 'center',
-    paddingVertical: 40,
-    paddingHorizontal: 20,
-    backgroundColor: '#fff',
-    borderRadius: 20,
-    marginTop: 10,
-    borderWidth: 1,
-    borderColor: '#f1f5f9',
-  },
-  emptyIconBg: {
-    width: 64,
-    height: 64,
-    borderRadius: 32,
-    backgroundColor: '#ecfdf5',
-    justifyContent: 'center',
-    alignItems: 'center',
-    marginBottom: 14,
-  },
-  emptyTitle: {
-    fontSize: 16,
-    fontWeight: '900',
-    color: '#1e293b',
-    marginBottom: 6,
-    textAlign: 'center',
-  },
-  emptySub: {
-    fontSize: 13,
-    color: '#64748b',
-    textAlign: 'center',
-    lineHeight: 20,
-    marginBottom: 16,
-  },
-  emptyAskBtn: {
-    backgroundColor: '#059669',
-    paddingHorizontal: 18,
-    paddingVertical: 10,
-    borderRadius: 14,
-  },
-  emptyAskBtnText: {
-    color: '#fff',
-    fontSize: 13,
-    fontWeight: '800',
-  },
-  fabContainer: {
-    position: 'absolute',
-    bottom: Platform.OS === 'ios' ? 95 : 82,
-    left: 20,
-    zIndex: 99,
-    borderRadius: 30,
-    shadowColor: '#059669',
-    shadowOffset: { width: 0, height: 6 },
-    shadowOpacity: 0.35,
-    shadowRadius: 12,
-    elevation: 8,
-  },
-  fabBtn: {
-    borderRadius: 30,
-  },
-  fabGrad: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    paddingHorizontal: 18,
-    paddingVertical: 12,
-    borderRadius: 30,
-    gap: 8,
-    borderWidth: 1.5,
-    borderColor: 'rgba(255,255,255,0.4)',
-  },
-  fabText: {
-    color: '#fff',
-    fontSize: 14,
-    fontWeight: '900',
-  },
-  locationGateOverlay: {
-    flex: 1,
-    backgroundColor: 'rgba(2, 6, 23, 0.62)',
-    alignItems: 'center',
-    justifyContent: 'center',
-    padding: 22,
-  },
-  locationGateCard: {
-    width: '100%',
-    maxWidth: 430,
-    backgroundColor: '#fff',
-    borderRadius: 28,
-    padding: 24,
-    alignItems: 'stretch',
-    shadowColor: '#000',
-    shadowOffset: { width: 0, height: 14 },
-    shadowOpacity: 0.2,
-    shadowRadius: 28,
-    elevation: 12,
-  },
-  locationGateIcon: {
-    alignSelf: 'center',
-    width: 62,
-    height: 62,
-    borderRadius: 31,
-    backgroundColor: '#ecfdf5',
-    alignItems: 'center',
-    justifyContent: 'center',
-    marginBottom: 14,
-  },
-  locationGateTitle: {
-    color: '#0f172a',
-    fontSize: 22,
-    fontWeight: '900',
-    textAlign: 'center',
-    marginBottom: 9,
-  },
-  locationGateText: {
-    color: '#475569',
-    fontSize: 14,
-    lineHeight: 22,
-    textAlign: 'center',
-    marginBottom: 16,
-  },
-  locationGateStatus: {
-    backgroundColor: '#f8fafc',
-    borderRadius: 16,
-    padding: 13,
-    borderWidth: 1,
-    borderColor: '#e2e8f0',
-    marginBottom: 12,
-  },
-  locationGateStatusRow: {
-    flexDirection: 'row-reverse',
-    alignItems: 'center',
-    justifyContent: 'center',
-    gap: 7,
-  },
-  locationGateStatusText: {
-    flex: 1,
-    color: '#334155',
-    fontSize: 12,
-    fontWeight: '800',
-    textAlign: 'right',
-  },
-  locationGateMessage: {
-    color: '#64748b',
-    fontSize: 12,
-    lineHeight: 18,
-    textAlign: 'center',
-    marginBottom: 12,
-  },
-  locationGatePrimary: {
-    minHeight: 52,
-    borderRadius: 16,
-    backgroundColor: '#059669',
-    alignItems: 'center',
-    justifyContent: 'center',
-    paddingHorizontal: 16,
-  },
-  locationGatePrimaryText: {
-    color: '#fff',
-    fontSize: 15,
-    fontWeight: '900',
-  },
-  locationGateRequired: {
-    color: '#94a3b8',
-    fontSize: 11,
-    textAlign: 'center',
-    marginTop: 11,
-  },
-
-  bottomNavWrapper: {
-    position: 'absolute',
-    bottom: 0,
-    left: 0,
-    right: 0,
-  },
-
-
-});
diff --git a/components/home/AtmosphereBar.tsx b/components/home/AtmosphereBar.tsx
new file mode 100644
index 0000000..c051430
--- /dev/null
+++ b/components/home/AtmosphereBar.tsx
@@ -0,0 +1,42 @@
+import { Text, View } from 'react-native';
+import { CloudSun, Flame, ShieldCheck } from 'lucide-react-native';
+import { styles } from './homeStyles';
+import { describeWeatherCode, type CurrentWeather } from '@/lib/weather';
+
+type Props = {
+  weather: CurrentWeather | null;
+  weatherLoading: boolean;
+  activeNeighbors: number;
+  emergencyCount: number;
+};
+
+export default function AtmosphereBar({ weather, weatherLoading, activeNeighbors, emergencyCount }: Props) {
+  const weatherText = weather
+    ? `${Math.round(weather.temperature)}°C · ${describeWeatherCode(weather.weatherCode)} · ${weather.locationName}`
+    : weatherLoading
+      ? 'جارٍ جلب الطقس الحالي...'
+      : 'الطقس غير متاح حالياً';
+
+  return (
+    <View style={styles.atmosphereBar}>
+      <View style={styles.atmoItem}>
+        <CloudSun size={15} color="#059669" />
+        <Text style={styles.atmoText} numberOfLines={1}>{weatherText}</Text>
+      </View>
+      <View style={styles.atmoDivider} />
+      <View style={styles.atmoItem}>
+        <Flame size={15} color="#f59e0b" />
+        <Text style={styles.atmoText}>
+          {activeNeighbors > 0 ? `${activeNeighbors} جار نشط اليوم` : 'كن أول المشاركين اليوم'}
+        </Text>
+      </View>
+      <View style={styles.atmoDivider} />
+      <View style={styles.atmoItem}>
+        <ShieldCheck size={15} color={emergencyCount > 0 ? '#dc2626' : '#059669'} />
+        <Text style={styles.atmoText}>
+          {emergencyCount > 0 ? `${emergencyCount} بلاغ طارئ` : 'لا بلاغات طارئة'}
+        </Text>
+      </View>
+    </View>
+  );
+}
diff --git a/components/home/EmptyState.tsx b/components/home/EmptyState.tsx
new file mode 100644
index 0000000..d477be4
--- /dev/null
+++ b/components/home/EmptyState.tsx
@@ -0,0 +1,90 @@
+import { Pressable, Text, View } from 'react-native';
+import { router } from 'expo-router';
+import { MessageCircle, ShieldCheck, Sparkles, Truck, User, Wrench } from 'lucide-react-native';
+import { styles } from './homeStyles';
+import type { HomeTab } from '@/lib/homeUtils';
+
+type Props = {
+  tab: HomeTab;
+  searching: boolean;
+  city: string;
+  hasExactLocation: boolean;
+};
+
+export default function EmptyState({ tab, searching, city, hasExactLocation }: Props) {
+  const cfg = (() => {
+    const searchSub = 'جرّب كلمات أخرى أو امسح البحث.';
+    switch (tab) {
+      case 'mine':
+        return {
+          Icon: User, color: '#059669',
+          title: searching ? 'لا توجد منشورات تطابق البحث' : 'لا توجد منشورات بعد',
+          sub: searching ? searchSub : 'استفساراتك وطلباتك ستظهر هنا عند نشرها في الحي.',
+          cta: searching ? null : { label: 'انشر أول استفسار لك', bg: '#059669' },
+        };
+      case 'emergency':
+        return {
+          Icon: ShieldCheck, color: '#16a34a',
+          title: searching ? 'لا توجد نتائج طوارئ مطابقة' : 'الحمد لله، لا توجد طوارئ',
+          sub: searching ? searchSub : 'الحي آمن ومستقر بفضل الله.',
+          cta: null,
+        };
+      case 'tools':
+        return {
+          Icon: Wrench, color: '#16a34a',
+          title: searching ? 'لا توجد عروض إعارة مطابقة' : 'لا توجد عروض إعارة حالياً',
+          sub: searching ? searchSub : 'هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟',
+          cta: searching ? null : { label: 'اعرض أداة للإعارة المجانية', bg: '#16a34a' },
+        };
+      case 'questions':
+        return {
+          Icon: MessageCircle, color: '#059669',
+          title: searching ? 'لا توجد استفسارات مطابقة' : 'لا توجد استفسارات حالياً',
+          sub: searching ? searchSub : 'اطرح سؤالك الأول لأهل الحي وتلقَّ ردوداً وتوصيات مجرّبة.',
+          cta: searching ? null : { label: 'اطرح سؤالك الآن', bg: '#059669' },
+        };
+      case 'requests':
+        return {
+          Icon: Truck, color: '#d97706',
+          title: searching ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات فزعة حالياً',
+          sub: searching ? searchSub : 'شارك جيرانك أي مساعدة تحتاجها وسيقف أهل حيك بجانبك.',
+          cta: null,
+        };
+      default:
+        return {
+          Icon: Sparkles, color: '#059669',
+          title: searching
+            ? 'لا توجد نتائج مطابقة للبحث'
+            : !hasExactLocation
+              ? 'حدّد حيّك لعرض منشورات جيرانك'
+              : `لا توجد استفسارات في ${city} حالياً`,
+          sub: searching
+            ? 'جرّب كلمات أخرى أو امسح البحث لعرض جميع المنشورات.'
+            : !hasExactLocation
+              ? 'تُعرض المنشورات حسب الحي فقط لحماية خصوصية الجميع. اختر منطقتك ومدينتك وحيّك من الأعلى.'
+              : 'كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك.',
+          cta: searching || !hasExactLocation ? null : { label: 'اسأل أهل حيك الآن', bg: '#059669' },
+        };
+    }
+  })();
+
+  const { Icon } = cfg;
+  return (
+    <View style={styles.emptyContainer}>
+      <View style={styles.emptyIconBg}>
+        <Icon size={36} color={cfg.color} />
+      </View>
+      <Text style={styles.emptyTitle}>{cfg.title}</Text>
+      <Text style={styles.emptySub}>{cfg.sub}</Text>
+      {cfg.cta && (
+        <Pressable
+          style={[styles.emptyAskBtn, { backgroundColor: cfg.cta.bg }]}
+          onPress={() => router.push('/ask')}
+          accessibilityRole="button"
+        >
+          <Text style={styles.emptyAskBtnText}>{cfg.cta.label}</Text>
+        </Pressable>
+      )}
+    </View>
+  );
+}
diff --git a/components/home/FeedTabs.tsx b/components/home/FeedTabs.tsx
new file mode 100644
index 0000000..a9fbb4a
--- /dev/null
+++ b/components/home/FeedTabs.tsx
@@ -0,0 +1,47 @@
+import { Pressable, ScrollView, Text, View } from 'react-native';
+import { Flame, Map, MessageCircle, Truck, User, Wrench } from 'lucide-react-native';
+import { styles } from './homeStyles';
+import type { HomeTab } from '@/lib/homeUtils';
+
+type Props = {
+  activeTab: HomeTab;
+  onChange: (tab: HomeTab) => void;
+  counts: { mine: number; emergency: number; tools: number; questions: number; requests: number };
+};
+
+export default function FeedTabs({ activeTab, onChange, counts }: Props) {
+  const tab = (
+    key: HomeTab,
+    label: string,
+    Icon: any,
+    activeStyle: any,
+  ) => {
+    const active = activeTab === key;
+    return (
+      <Pressable
+        key={key}
+        style={[styles.fTab, active && activeStyle]}
+        onPress={() => onChange(key)}
+        accessibilityRole="tab"
+        accessibilityState={{ selected: active }}
+        accessibilityLabel={label}
+      >
+        <View style={styles.fTabLabelRow}>
+          <Icon size={15} color={active ? '#fff' : '#475569'} />
+          <Text style={[styles.fTabText, active && styles.fTabTextActive]}>{label}</Text>
+        </View>
+      </Pressable>
+    );
+  };
+
+  return (
+    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingTabs}>
+      {tab('all', 'الكل', Map, styles.fTabActive)}
+      {tab('mine', `منشوراتي (${counts.mine})`, User, styles.fTabActiveMine)}
+      {counts.emergency > 0 && tab('emergency', `طوارئ (${counts.emergency})`, Flame, styles.fTabActiveRed)}
+      {tab('tools', `إعارة (${counts.tools})`, Wrench, styles.fTabActiveGreen)}
+      {tab('questions', `استفسارات (${counts.questions})`, MessageCircle, styles.fTabActive)}
+      {tab('requests', `فزعة (${counts.requests})`, Truck, styles.fTabActive)}
+    </ScrollView>
+  );
+}
diff --git a/components/home/HomeHero.tsx b/components/home/HomeHero.tsx
new file mode 100644
index 0000000..97414cd
--- /dev/null
+++ b/components/home/HomeHero.tsx
@@ -0,0 +1,129 @@
+import { Image, Pressable, Text, TextInput, View } from 'react-native';
+import { router } from 'expo-router';
+import { LinearGradient } from 'expo-linear-gradient';
+import { Bell, ChevronDown, MapPin, Mic, Search, ShieldCheck, X } from 'lucide-react-native';
+import { styles } from './homeStyles';
+import type { Profile } from '@/lib/homeUtils';
+
+type Props = {
+  profile: Profile | null;
+  logoUri: string;
+  greeting: string;
+  unreadCount: number;
+  city: string;
+  district: string;
+  searchQuery: string;
+  onSearchChange: (v: string) => void;
+  onOpenLocation: () => void;
+};
+
+export default function HomeHero({
+  profile, logoUri, greeting, unreadCount, city, district,
+  searchQuery, onSearchChange, onOpenLocation,
+}: Props) {
+  const locationLabel =
+    city === 'كل المدن'
+      ? 'كل مناطق المملكة'
+      : `${city}${district !== 'كل الأحياء' ? ` · حي ${district}` : ''}`;
+
+  return (
+    <LinearGradient
+      colors={['#065f46', '#059669', '#10b981']}
+      start={{ x: 0, y: 0 }}
+      end={{ x: 1, y: 1 }}
+      style={styles.hero}
+    >
+      <View style={styles.topNavRow}>
+        <View style={styles.leftActions}>
+          <Pressable
+            onPress={() => router.push('/profile')}
+            style={styles.avatarWrap}
+            accessibilityRole="button"
+            accessibilityLabel="الملف الشخصي"
+          >
+            {profile?.avatar_url ? (
+              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
+            ) : (
+              <View style={styles.avatarPlaceholder}>
+                <Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text>
+              </View>
+            )}
+            {profile?.is_geoverified && (
+              <View style={styles.avatarVerifiedBadge}>
+                <ShieldCheck size={10} color="#fff" />
+              </View>
+            )}
+          </Pressable>
+
+          <Pressable
+            onPress={() => router.push('/notifications')}
+            style={styles.iconCircleBtn}
+            accessibilityRole="button"
+            accessibilityLabel={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
+          >
+            <Bell size={20} color="#fff" />
+            {unreadCount > 0 && (
+              <View style={styles.notifBadge}>
+                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
+              </View>
+            )}
+          </Pressable>
+        </View>
+
+        <View style={styles.brandAndLocation}>
+          <View style={styles.brandTitleRow}>
+            <Image source={{ uri: logoUri }} style={styles.headerLogo} resizeMode="contain" />
+          </View>
+          <Pressable
+            style={styles.locationSelectorPill}
+            onPress={onOpenLocation}
+            accessibilityRole="button"
+            accessibilityLabel={`الموقع الحالي ${locationLabel}، اضغط للتغيير`}
+          >
+            <ChevronDown size={14} color="#a7f3d0" />
+            <Text style={styles.locationSelectorText} numberOfLines={1}>{locationLabel}</Text>
+            <MapPin size={13} color="#6ee7b7" />
+          </Pressable>
+        </View>
+      </View>
+
+      <Text style={styles.heroGreeting} numberOfLines={1}>
+        {greeting}{profile?.display_name ? `، ${profile.display_name}` : ''}
+      </Text>
+
+      <View style={styles.searchBarContainer}>
+        <View style={styles.searchBar}>
+          <Search size={20} color="#94a3b8" />
+          <TextInput
+            placeholder="ابحث عن استفسار أو طلب أو اسم جار..."
+            placeholderTextColor="#94a3b8"
+            style={styles.searchInput}
+            accessibilityLabel="البحث في الاستفسارات والطلبات وأسماء الجيران"
+            value={searchQuery}
+            onChangeText={onSearchChange}
+            returnKeyType="search"
+          />
+          {searchQuery.length > 0 ? (
+            <Pressable
+              onPress={() => onSearchChange('')}
+              style={styles.clearSearchBtn}
+              accessibilityRole="button"
+              accessibilityLabel="مسح البحث"
+            >
+              <X size={17} color="#64748b" />
+            </Pressable>
+          ) : (
+            <Pressable
+              style={styles.micBtn}
+              onPress={() => router.push('/questions')}
+              accessibilityRole="button"
+              accessibilityLabel="كل الاستفسارات"
+            >
+              <Mic size={17} color="#059669" />
+            </Pressable>
+          )}
+        </View>
+      </View>
+    </LinearGradient>
+  );
+}
diff --git a/components/home/HomeStates.tsx b/components/home/HomeStates.tsx
new file mode 100644
index 0000000..1a8c952
--- /dev/null
+++ b/components/home/HomeStates.tsx
@@ -0,0 +1,41 @@
+import { useEffect, useRef } from 'react';
+import { Animated, Pressable, Text, View } from 'react-native';
+import { styles } from './homeStyles';
+
+export function FeedSkeleton({ count = 3 }: { count?: number }) {
+  const opacity = useRef(new Animated.Value(0.5)).current;
+
+  useEffect(() => {
+    const loop = Animated.loop(
+      Animated.sequence([
+        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
+        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
+      ]),
+    );
+    loop.start();
+    return () => loop.stop();
+  }, [opacity]);
+
+  return (
+    <>
+      {Array.from({ length: count }).map((_, i) => (
+        <Animated.View key={i} style={[styles.skeletonCard, { opacity }]} accessibilityLabel="جارٍ التحميل">
+          <View style={[styles.skeletonLine, { width: '45%' }]} />
+          <View style={[styles.skeletonLine, { width: '90%' }]} />
+          <View style={[styles.skeletonLine, { width: '70%' }]} />
+        </Animated.View>
+      ))}
+    </>
+  );
+}
+
+export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
+  return (
+    <View style={styles.errorBanner} accessibilityRole="alert">
+      <Pressable style={styles.errorRetryBtn} onPress={onRetry} accessibilityRole="button">
+        <Text style={styles.errorRetryText}>إعادة المحاولة</Text>
+      </Pressable>
+      <Text style={styles.errorBannerText}>{message}</Text>
+    </View>
+  );
+}
diff --git a/components/home/LocationModals.tsx b/components/home/LocationModals.tsx
new file mode 100644
index 0000000..39136ff
--- /dev/null
+++ b/components/home/LocationModals.tsx
@@ -0,0 +1,96 @@
+import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
+import { MapPin } from 'lucide-react-native';
+import { styles } from './homeStyles';
+
+type GateProps = {
+  visible: boolean;
+  busy: boolean;
+  message: string;
+  region: string;
+  city: string;
+  district: string;
+  hasExactLocation: boolean;
+  onSetupLocation: () => void;
+  onEnableNotifications: () => void;
+};
+
+/** Mandatory first-login setup: location, then notifications. */
+export function LocationGateModal({
+  visible, busy, message, region, city, district, hasExactLocation,
+  onSetupLocation, onEnableNotifications,
+}: GateProps) {
+  return (
+    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
+      <View style={styles.locationGateOverlay}>
+        <View style={styles.locationGateCard}>
+          <View style={styles.locationGateIcon}><MapPin size={28} color="#059669" /></View>
+          <Text style={styles.locationGateTitle}>نحتاج موقعك قبل البدء</Text>
+          <Text style={styles.locationGateText}>
+            حدّد موقعك تلقائياً لربط حسابك بالمنطقة والمدينة والحي، ثم فعّل الإشعارات لتصلك أخبار وتنبيهات حيّك فوراً.
+          </Text>
+
+          <View style={styles.locationGateStatus}>
+            <View style={styles.locationGateStatusRow}>
+              <MapPin size={17} color="#059669" />
+              <Text style={styles.locationGateStatusText}>
+                {hasExactLocation ? `الموقع: ${region} · ${city} · حي ${district}` : 'الموقع غير مكتمل'}
+              </Text>
+            </View>
+          </View>
+
+          {!!message && <Text style={styles.locationGateMessage}>{message}</Text>}
+
+          <Pressable
+            style={styles.locationGatePrimary}
+            onPress={hasExactLocation ? onEnableNotifications : onSetupLocation}
+            disabled={busy}
+            accessibilityRole="button"
+          >
+            {busy ? (
+              <ActivityIndicator color="#fff" />
+            ) : (
+              <Text style={styles.locationGatePrimaryText}>
+                {hasExactLocation ? 'تفعيل الإشعارات والمتابعة' : 'تحديد موقعي تلقائياً'}
+              </Text>
+            )}
+          </Pressable>
+
+          <Text style={styles.locationGateRequired}>
+            تحديد الموقع مطلوب. الإشعارات يمكن تفعيلها الآن أو لاحقاً من الإعدادات.
+          </Text>
+        </View>
+      </View>
+    </Modal>
+  );
+}
+
+type PromptProps = {
+  visible: boolean;
+  onAllow: () => void;
+  onLater: () => void;
+};
+
+/** Weekly "refresh my location" prompt (was missing its Modal in the original). */
+export function WeeklyLocationPrompt({ visible, onAllow, onLater }: PromptProps) {
+  return (
+    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
+      <View style={styles.locationPromptBackdrop}>
+        <View style={styles.locationPromptCard}>
+          <View style={styles.locationGateIcon}><MapPin size={26} color="#059669" /></View>
+          <Text style={styles.locationPromptTitle}>تحديث موقعك الأسبوعي</Text>
+          <Text style={styles.locationPromptText}>
+            هل ما زلت في نفس الحي؟ حدّث موقعك لتصلك منشورات وتنبيهات جيرانك بدقة.
+          </Text>
+          <View style={styles.locationPromptActions}>
+            <Pressable style={styles.locationPromptAllow} onPress={onAllow} accessibilityRole="button">
+              <Text style={styles.locationPromptAllowText}>تحديث الآن</Text>
+            </Pressable>
+            <Pressable style={styles.locationPromptLater} onPress={onLater} accessibilityRole="button">
+              <Text style={styles.locationPromptLaterText}>لاحقاً</Text>
+            </Pressable>
+          </View>
+        </View>
+      </View>
+    </Modal>
+  );
+}
diff --git a/components/home/ServicesGrid.tsx b/components/home/ServicesGrid.tsx
new file mode 100644
index 0000000..d9cd811
--- /dev/null
+++ b/components/home/ServicesGrid.tsx
@@ -0,0 +1,43 @@
+import { Pressable, Text, View } from 'react-native';
+import { router } from 'expo-router';
+import { Briefcase, Camera, Map, MessageCircle, Truck, Wrench } from 'lucide-react-native';
+import type { ReactNode } from 'react';
+import { styles } from './homeStyles';
+
+type PillProps = {
+  icon: ReactNode;
+  bg: string;
+  label: string;
+  badge?: string;
+  badgeBg?: string;
+  onPress?: () => void;
+};
+
+function ServicePill({ icon, bg, label, badge, badgeBg, onPress }: PillProps) {
+  return (
+    <Pressable style={styles.servicePill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
+      <View style={[styles.serviceIconBox, { backgroundColor: bg }]}>
+        {icon}
+        {badge ? (
+          <View style={[styles.servicePillBadge, badgeBg ? { backgroundColor: badgeBg } : {}]}>
+            <Text style={styles.servicePillBadgeText}>{badge}</Text>
+          </View>
+        ) : null}
+      </View>
+      <Text style={styles.serviceLabel} numberOfLines={1}>{label}</Text>
+    </Pressable>
+  );
+}
+
+export default function ServicesGrid({ onTools }: { onTools: () => void }) {
+  return (
+    <View style={styles.servicesGrid}>
+      <ServicePill icon={<MessageCircle size={22} color="#059669" />} bg="#ecfdf5" label="اسأل الحي" badge="فوري" badgeBg="#059669" onPress={() => router.push('/ask')} />
+      <ServicePill icon={<Camera size={22} color="#8b5cf6" />} bg="#f5f3ff" label="يوميات الحي" badge="24 ساعة" badgeBg="#7c3aed" onPress={() => router.push('/create-story')} />
+      <ServicePill icon={<Wrench size={22} color="#16a34a" />} bg="#f0fdf4" label="إعارة أدوات" badge="مجاني" badgeBg="#16a34a" onPress={onTools} />
+      <ServicePill icon={<Briefcase size={22} color="#0284c7" />} bg="#f0f9ff" label="خدمات الحي" badge="مهنيون" badgeBg="#0284c7" onPress={() => router.push('/services')} />
+      <ServicePill icon={<Truck size={22} color="#d97706" />} bg="#fffbeb" label="فزعة وطلبات" badge="تعاون" badgeBg="#d97706" onPress={() => router.push('/requests')} />
+      <ServicePill icon={<Map size={22} color="#059669" />} bg="#ecfdf5" label="خريطة الحي" badge="مباشر" badgeBg="#059669" onPress={() => router.push('/map')} />
+    </View>
+  );
+}
diff --git a/components/home/StoriesRow.tsx b/components/home/StoriesRow.tsx
new file mode 100644
index 0000000..a4cd11e
--- /dev/null
+++ b/components/home/StoriesRow.tsx
@@ -0,0 +1,110 @@
+import { Image, Pressable, ScrollView, Text, View } from 'react-native';
+import { router } from 'expo-router';
+import { LinearGradient } from 'expo-linear-gradient';
+import { Camera, Plus, ShieldCheck } from 'lucide-react-native';
+import { styles } from './homeStyles';
+import type { Profile, Story } from '@/lib/homeUtils';
+
+type Props = {
+  profile: Profile | null;
+  stories: Story[];
+  selectedDistrict: string;
+};
+
+export default function StoriesRow({ profile, stories, selectedDistrict }: Props) {
+  return (
+    <View style={styles.storiesContainer}>
+      <View style={styles.storiesHeaderRow}>
+        <Pressable
+          style={styles.publishStoryHeaderBtn}
+          onPress={() => router.push('/create-story')}
+          accessibilityRole="button"
+          accessibilityLabel="نشر يوميات"
+        >
+          <Plus size={14} color="#059669" />
+          <Text style={styles.publishStoryHeaderText}>نشر يوميات</Text>
+        </Pressable>
+        <View style={styles.storiesTitleRow}>
+          <View style={styles.storiesLiveBadge}>
+            <View style={styles.storiesLivePulseDot} />
+            <Text style={styles.storiesLiveText}>مباشر 24س</Text>
+          </View>
+          <Text style={styles.storiesSectionTitle}>يوميات الحي</Text>
+        </View>
+      </View>
+
+      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
+        <Pressable style={styles.storyBox} onPress={() => router.push('/create-story')}>
+          <LinearGradient
+            colors={['#059669', '#10b981', '#34d399']}
+            style={styles.storyAddRing}
+            start={{ x: 0, y: 0 }}
+            end={{ x: 1, y: 1 }}
+          >
+            <View style={styles.storyInnerBorder}>
+              {profile?.avatar_url ? (
+                <Image source={{ uri: profile.avatar_url }} style={styles.storyImg} />
+              ) : (
+                <View style={styles.storySelfPlaceholder}>
+                  <Camera size={20} color="#059669" />
+                </View>
+              )}
+              <View style={styles.storySelfPlusBadge}>
+                <Plus size={11} color="#fff" strokeWidth={3} />
+              </View>
+            </View>
+          </LinearGradient>
+          <Text style={styles.storyName}>أضف يومياتك</Text>
+          <Text style={styles.storyDistrictSub}>قصتك أنت</Text>
+        </Pressable>
+
+        {stories.map(story => {
+          const authorName = story.profiles?.display_name || story.profiles?.username || 'جار';
+          const avatarUrl = story.profiles?.avatar_url;
+          const verified = story.profiles?.is_verified || story.profiles?.is_geoverified;
+          const bg = story.bg_color || '#059669';
+
+          return (
+            <Pressable
+              key={story.id}
+              style={styles.storyBox}
+              onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
+              accessibilityRole="button"
+              accessibilityLabel={`يوميات ${authorName}`}
+            >
+              <LinearGradient
+                colors={['#059669', '#10b981', '#3b82f6']}
+                style={styles.storyGradientRing}
+                start={{ x: 0, y: 0 }}
+                end={{ x: 1, y: 1 }}
+              >
+                <View style={styles.storyInnerBorder}>
+                  {story.type === 'text' ? (
+                    <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
+                      <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>{story.content?.[0] || 'ق'}</Text>
+                    </View>
+                  ) : avatarUrl ? (
+                    <Image source={{ uri: avatarUrl }} style={styles.storyImg} />
+                  ) : (
+                    <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
+                      <Text style={styles.storyTextPreviewLetter}>{authorName[0]}</Text>
+                    </View>
+                  )}
+                </View>
+                {verified && (
+                  <View style={styles.storyVerifiedTag}>
+                    <ShieldCheck size={9} color="#fff" />
+                  </View>
+                )}
+              </LinearGradient>
+              <Text style={styles.storyName} numberOfLines={1}>{authorName}</Text>
+              <Text style={styles.storyDistrictSub} numberOfLines={1}>
+                {selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'جار الحي'}
+              </Text>
+            </Pressable>
+          );
+        })}
+      </ScrollView>
+    </View>
+  );
+}
diff --git a/components/home/homeStyles.ts b/components/home/homeStyles.ts
new file mode 100644
index 0000000..9b526a6
--- /dev/null
+++ b/components/home/homeStyles.ts
@@ -0,0 +1,704 @@
+import { StyleSheet } from 'react-native';
+
+export const styles = StyleSheet.create({
+  locationPromptBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24 },
+  locationPromptCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 22, alignItems: 'center' },
+  locationPromptTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#064e3b', textAlign: 'center' },
+  locationPromptText: { marginTop: 8, fontSize: 13, lineHeight: 21, color: '#475569', textAlign: 'center' },
+  locationPromptActions: { width: '100%', flexDirection: 'row-reverse', gap: 10, marginTop: 18 },
+  locationPromptAllow: { flex: 1, backgroundColor: '#059669', borderRadius: 14, padding: 13, alignItems: 'center' },
+  locationPromptAllowText: { color: '#fff', fontWeight: '900' },
+  locationPromptLater: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 14, padding: 13, alignItems: 'center' },
+  locationPromptLaterText: { color: '#475569', fontWeight: '900' },
+  container: {
+    flex: 1,
+    backgroundColor: '#f8fafc',
+  },
+  hero: {
+    paddingTop: Platform.OS === 'ios' ? 52 : 38,
+    paddingBottom: 22,
+    borderBottomLeftRadius: 32,
+    borderBottomRightRadius: 32,
+    shadowColor: '#059669',
+    shadowOffset: { width: 0, height: 8 },
+    shadowOpacity: 0.2,
+    shadowRadius: 16,
+    elevation: 8,
+  },
+  topNavRow: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    justifyContent: 'space-between',
+    paddingHorizontal: 20,
+    marginBottom: 16,
+  },
+  brandAndLocation: {
+    alignItems: 'flex-end',
+  },
+  brandTitleRow: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    gap: 6,
+    marginBottom: 4,
+  },
+  headerLogo: {
+    width: 38,
+    height: 38,
+    marginLeft: 7,
+  },
+  locationSelectorPill: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    backgroundColor: 'rgba(255,255,255,0.22)',
+    paddingHorizontal: 10,
+    paddingVertical: 4,
+    borderRadius: 20,
+    gap: 5,
+    borderWidth: 1,
+    borderColor: 'rgba(255,255,255,0.35)',
+  },
+  locationSelectorText: {
+    color: '#fff',
+    fontSize: 11,
+    fontWeight: '800',
+    maxWidth: 200,
+  },
+  leftActions: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    gap: 10,
+  },
+  avatarWrap: {
+    position: 'relative',
+  },
+  avatarImg: {
+    width: 44,
+    height: 44,
+    borderRadius: 22,
+    borderWidth: 2,
+    borderColor: '#fff',
+  },
+  avatarPlaceholder: {
+    width: 44,
+    height: 44,
+    borderRadius: 22,
+    backgroundColor: 'rgba(255,255,255,0.25)',
+    justifyContent: 'center',
+    alignItems: 'center',
+    borderWidth: 2,
+    borderColor: '#fff',
+  },
+  avatarLetter: {
+    color: '#fff',
+    fontSize: 18,
+    fontWeight: '900',
+  },
+  avatarVerifiedBadge: {
+    position: 'absolute',
+    bottom: -2,
+    right: -2,
+    width: 16,
+    height: 16,
+    borderRadius: 8,
+    backgroundColor: '#16a34a',
+    justifyContent: 'center',
+    alignItems: 'center',
+    borderWidth: 1.5,
+    borderColor: '#fff',
+  },
+  iconCircleBtn: {
+    width: 40,
+    height: 40,
+    borderRadius: 20,
+    backgroundColor: 'rgba(255,255,255,0.2)',
+    justifyContent: 'center',
+    alignItems: 'center',
+    borderWidth: 1,
+    borderColor: 'rgba(255,255,255,0.3)',
+    position: 'relative',
+  },
+  notifBadge: {
+    position: 'absolute',
+    top: -2,
+    right: -2,
+    backgroundColor: '#ef4444',
+    borderRadius: 10,
+    minWidth: 18,
+    height: 18,
+    alignItems: 'center',
+    justifyContent: 'center',
+    paddingHorizontal: 3,
+    borderWidth: 1.5,
+    borderColor: '#fff',
+  },
+  notifBadgeText: {
+    color: '#fff',
+    fontSize: 10,
+    fontWeight: '900',
+  },
+  searchBarContainer: {
+    paddingHorizontal: 20,
+  },
+  searchBar: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    backgroundColor: '#fff',
+    borderRadius: 16,
+    paddingHorizontal: 14,
+    height: 48,
+    shadowColor: '#000',
+    shadowOffset: { width: 0, height: 3 },
+    shadowOpacity: 0.1,
+    shadowRadius: 6,
+    elevation: 3,
+    gap: 8,
+  },
+  searchInput: {
+    flex: 1,
+    fontSize: 13,
+    color: '#0f172a',
+    textAlign: 'right',
+  },
+  micBtn: {
+    padding: 6,
+  },
+  clearSearchBtn: {
+    padding: 6,
+  },
+  // Atmosphere & Neighborhood Pulse Bar
+  atmosphereBar: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    justifyContent: 'space-around',
+    backgroundColor: '#fff',
+    marginHorizontal: 16,
+    marginTop: -14,
+    marginBottom: 12,
+    borderRadius: 18,
+    paddingVertical: 10,
+    paddingHorizontal: 14,
+    shadowColor: '#000',
+    shadowOffset: { width: 0, height: 3 },
+    shadowOpacity: 0.06,
+    shadowRadius: 8,
+    elevation: 3,
+    borderWidth: 1,
+    borderColor: '#f1f5f9',
+    zIndex: 10,
+  },
+  atmoItem: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    gap: 6,
+  },
+  atmoText: {
+    fontSize: 11,
+    fontWeight: '800',
+    color: '#334155',
+  },
+  atmoDivider: {
+    width: 1,
+    height: 16,
+    backgroundColor: '#e2e8f0',
+  },
+
+  // Upgraded Stories Section
+  storiesContainer: {
+    paddingVertical: 14,
+    backgroundColor: '#fff',
+    borderBottomWidth: 1,
+    borderBottomColor: '#f1f5f9',
+  },
+  storiesHeaderRow: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    justifyContent: 'space-between',
+    paddingHorizontal: 16,
+    marginBottom: 12,
+  },
+  storiesTitleRow: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    gap: 8,
+  },
+  storiesSectionTitle: {
+    fontSize: 14,
+    fontWeight: '900',
+    color: '#0f172a',
+  },
+  storiesLiveBadge: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    backgroundColor: '#ecfdf5',
+    paddingHorizontal: 7,
+    paddingVertical: 2.5,
+    borderRadius: 10,
+    borderWidth: 1,
+    borderColor: '#a7f3d0',
+    gap: 4,
+  },
+  storiesLivePulseDot: {
+    width: 6,
+    height: 6,
+    borderRadius: 3,
+    backgroundColor: '#10b981',
+  },
+  storiesLiveText: {
+    fontSize: 9.5,
+    fontWeight: '800',
+    color: '#059669',
+  },
+  publishStoryHeaderBtn: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    backgroundColor: '#f0fdf4',
+    paddingHorizontal: 10,
+    paddingVertical: 4.5,
+    borderRadius: 14,
+    borderWidth: 1,
+    borderColor: '#bbf7d0',
+    gap: 4,
+  },
+  publishStoryHeaderText: {
+    fontSize: 11,
+    fontWeight: '800',
+    color: '#059669',
+  },
+  storiesScroll: {
+    paddingHorizontal: 16,
+    gap: 14,
+    alignItems: 'flex-start',
+  },
+  storyBox: {
+    alignItems: 'center',
+    width: 68,
+  },
+  storyAddRing: {
+    width: 66,
+    height: 66,
+    borderRadius: 33,
+    padding: 2.5,
+    justifyContent: 'center',
+    alignItems: 'center',
+    marginBottom: 5,
+  },
+  storyGradientRing: {
+    width: 66,
+    height: 66,
+    borderRadius: 33,
+    padding: 2.5,
+    justifyContent: 'center',
+    alignItems: 'center',
+    marginBottom: 5,
+    position: 'relative',
+  },
+  storyInnerBorder: {
+    width: '100%',
+    height: '100%',
+    borderRadius: 31,
+    borderWidth: 2,
+    borderColor: '#fff',
+    overflow: 'hidden',
+    justifyContent: 'center',
+    alignItems: 'center',
+    backgroundColor: '#f8fafc',
+    position: 'relative',
+  },
+  storySelfPlaceholder: {
+    width: '100%',
+    height: '100%',
+    backgroundColor: '#ecfdf5',
+    justifyContent: 'center',
+    alignItems: 'center',
+  },
+  storySelfPlusBadge: {
+    position: 'absolute',
+    bottom: 0,
+    right: 0,
+    backgroundColor: '#059669',
+    width: 20,
+    height: 20,
+    borderRadius: 10,
+    justifyContent: 'center',
+    alignItems: 'center',
+    borderWidth: 2,
+    borderColor: '#fff',
+  },
+  storyImg: {
+    width: '100%',
+    height: '100%',
+    borderRadius: 30,
+  },
+  storyTextPreview: {
+    width: '100%',
+    height: '100%',
+    borderRadius: 30,
+    justifyContent: 'center',
+    alignItems: 'center',
+  },
+  storyTextPreviewLetter: {
+    color: '#fff',
+    fontSize: 22,
+    fontWeight: '900',
+  },
+  storyVerifiedTag: {
+    position: 'absolute',
+    bottom: -1,
+    right: -1,
+    width: 18,
+    height: 18,
+    borderRadius: 9,
+    backgroundColor: '#16a34a',
+    justifyContent: 'center',
+    alignItems: 'center',
+    borderWidth: 1.5,
+    borderColor: '#fff',
+  },
+  storyName: {
+    fontSize: 11,
+    fontWeight: '800',
+    color: '#0f172a',
+    textAlign: 'center',
+  },
+  storyDistrictSub: {
+    fontSize: 9.5,
+    color: '#64748b',
+    fontWeight: '600',
+    textAlign: 'center',
+    marginTop: 1,
+  },
+
+  // Service Pill Badges
+  servicePillBadge: {
+    position: 'absolute',
+    top: -5,
+    right: -6,
+    backgroundColor: '#059669',
+    paddingHorizontal: 4,
+    paddingVertical: 1,
+    borderRadius: 8,
+    borderWidth: 1.5,
+    borderColor: '#fff',
+    zIndex: 5,
+  },
+  servicePillBadgeText: {
+    color: '#fff',
+    fontSize: 7.5,
+    fontWeight: '900',
+  },
+  emergencyHomeCard: {
+    marginHorizontal: 16,
+    marginTop: 12,
+    backgroundColor: '#fef2f2',
+    borderRadius: 18,
+    padding: 14,
+    borderWidth: 2,
+    borderColor: '#fca5a5',
+  },
+  emergencyHomeHeader: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    justifyContent: 'space-between',
+    marginBottom: 6,
+  },
+  emergencyHomeTitle: {
+    fontSize: 13,
+    fontWeight: '900',
+    color: '#dc2626',
+  },
+  emergencyLiveBadge: {
+    backgroundColor: '#dc2626',
+    paddingHorizontal: 7,
+    paddingVertical: 2,
+    borderRadius: 6,
+  },
+  emergencyLiveText: {
+    color: '#fff',
+    fontSize: 9,
+    fontWeight: '900',
+  },
+  emergencyContentBox: {
+    backgroundColor: '#fff',
+    borderRadius: 12,
+    padding: 10,
+    borderWidth: 1,
+    borderColor: '#fecaca',
+  },
+  emergencyQuestionTitle: {
+    fontSize: 13,
+    fontWeight: '900',
+    color: '#991b1b',
+    textAlign: 'right',
+  },
+  emergencyQuestionSub: {
+    fontSize: 11,
+    color: '#dc2626',
+    textAlign: 'right',
+    marginTop: 3,
+  },
+  servicesGrid: {
+    flexDirection: 'row-reverse',
+    justifyContent: 'space-between',
+    paddingHorizontal: 16,
+    marginTop: 14,
+    marginBottom: 8,
+  },
+  servicePill: {
+    alignItems: 'center',
+    width: (width - 48) / 6,
+  },
+  serviceIconBox: {
+    width: 44,
+    height: 44,
+    borderRadius: 14,
+    justifyContent: 'center',
+    alignItems: 'center',
+    marginBottom: 5,
+    shadowColor: '#000',
+    shadowOffset: { width: 0, height: 2 },
+    shadowOpacity: 0.05,
+    shadowRadius: 4,
+    elevation: 1,
+  },
+  serviceLabel: {
+    fontSize: 10,
+    fontWeight: '700',
+    color: '#334155',
+    textAlign: 'center',
+  },
+  feedSection: {
+    marginTop: 12,
+    paddingHorizontal: 16,
+  },
+  floatingTabs: {
+    flexDirection: 'row-reverse',
+    gap: 8,
+    marginBottom: 14,
+    paddingVertical: 4,
+  },
+  fTab: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    gap: 6,
+    paddingHorizontal: 14,
+    paddingVertical: 8,
+    borderRadius: 20,
+    backgroundColor: '#fff',
+    borderWidth: 1.5,
+    borderColor: '#e2e8f0',
+  },
+  fTabActive: {
+    backgroundColor: '#059669',
+    borderColor: '#059669',
+  },
+  fTabActiveRed: {
+    backgroundColor: '#dc2626',
+    borderColor: '#dc2626',
+  },
+  fTabActiveGreen: {
+    backgroundColor: '#16a34a',
+    borderColor: '#16a34a',
+  },
+  fTabActiveMine: {
+    backgroundColor: '#7c3aed',
+    borderColor: '#7c3aed',
+  },
+  fTabText: {
+    fontSize: 12,
+    fontWeight: '800',
+    color: '#475569',
+  },
+  fTabLabelRow: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    gap: 6,
+  },
+  fTabTextActive: {
+    color: '#fff',
+  },
+  // Empty state & FAB
+  emptyContainer: {
+    alignItems: 'center',
+    paddingVertical: 40,
+    paddingHorizontal: 20,
+    backgroundColor: '#fff',
+    borderRadius: 20,
+    marginTop: 10,
+    borderWidth: 1,
+    borderColor: '#f1f5f9',
+  },
+  emptyIconBg: {
+    width: 64,
+    height: 64,
+    borderRadius: 32,
+    backgroundColor: '#ecfdf5',
+    justifyContent: 'center',
+    alignItems: 'center',
+    marginBottom: 14,
+  },
+  emptyTitle: {
+    fontSize: 16,
+    fontWeight: '900',
+    color: '#1e293b',
+    marginBottom: 6,
+    textAlign: 'center',
+  },
+  emptySub: {
+    fontSize: 13,
+    color: '#64748b',
+    textAlign: 'center',
+    lineHeight: 20,
+    marginBottom: 16,
+  },
+  emptyAskBtn: {
+    backgroundColor: '#059669',
+    paddingHorizontal: 18,
+    paddingVertical: 10,
+    borderRadius: 14,
+  },
+  emptyAskBtnText: {
+    color: '#fff',
+    fontSize: 13,
+    fontWeight: '800',
+  },
+  fabContainer: {
+    position: 'absolute',
+    bottom: Platform.OS === 'ios' ? 95 : 82,
+    left: 20,
+    zIndex: 99,
+    borderRadius: 30,
+    shadowColor: '#059669',
+    shadowOffset: { width: 0, height: 6 },
+    shadowOpacity: 0.35,
+    shadowRadius: 12,
+    elevation: 8,
+  },
+  fabBtn: {
+    borderRadius: 30,
+  },
+  fabGrad: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    paddingHorizontal: 18,
+    paddingVertical: 12,
+    borderRadius: 30,
+    gap: 8,
+    borderWidth: 1.5,
+    borderColor: 'rgba(255,255,255,0.4)',
+  },
+  fabText: {
+    color: '#fff',
+    fontSize: 14,
+    fontWeight: '900',
+  },
+  locationGateOverlay: {
+    flex: 1,
+    backgroundColor: 'rgba(2, 6, 23, 0.62)',
+    alignItems: 'center',
+    justifyContent: 'center',
+    padding: 22,
+  },
+  locationGateCard: {
+    width: '100%',
+    maxWidth: 430,
+    backgroundColor: '#fff',
+    borderRadius: 28,
+    padding: 24,
+    alignItems: 'stretch',
+    shadowColor: '#000',
+    shadowOffset: { width: 0, height: 14 },
+    shadowOpacity: 0.2,
+    shadowRadius: 28,
+    elevation: 12,
+  },
+  locationGateIcon: {
+    alignSelf: 'center',
+    width: 62,
+    height: 62,
+    borderRadius: 31,
+    backgroundColor: '#ecfdf5',
+    alignItems: 'center',
+    justifyContent: 'center',
+    marginBottom: 14,
+  },
+  locationGateTitle: {
+    color: '#0f172a',
+    fontSize: 22,
+    fontWeight: '900',
+    textAlign: 'center',
+    marginBottom: 9,
+  },
+  locationGateText: {
+    color: '#475569',
+    fontSize: 14,
+    lineHeight: 22,
+    textAlign: 'center',
+    marginBottom: 16,
+  },
+  locationGateStatus: {
+    backgroundColor: '#f8fafc',
+    borderRadius: 16,
+    padding: 13,
+    borderWidth: 1,
+    borderColor: '#e2e8f0',
+    marginBottom: 12,
+  },
+  locationGateStatusRow: {
+    flexDirection: 'row-reverse',
+    alignItems: 'center',
+    justifyContent: 'center',
+    gap: 7,
+  },
+  locationGateStatusText: {
+    flex: 1,
+    color: '#334155',
+    fontSize: 12,
+    fontWeight: '800',
+    textAlign: 'right',
+  },
+  locationGateMessage: {
+    color: '#64748b',
+    fontSize: 12,
+    lineHeight: 18,
+    textAlign: 'center',
+    marginBottom: 12,
+  },
+  locationGatePrimary: {
+    minHeight: 52,
+    borderRadius: 16,
+    backgroundColor: '#059669',
+    alignItems: 'center',
+    justifyContent: 'center',
+    paddingHorizontal: 16,
+  },
+  locationGatePrimaryText: {
+    color: '#fff',
+    fontSize: 15,
+    fontWeight: '900',
+  },
+  locationGateRequired: {
+    color: '#94a3b8',
+    fontSize: 11,
+    textAlign: 'center',
+    marginTop: 11,
+  },
+
+  bottomNavWrapper: {
+    position: 'absolute',
+    bottom: 0,
+    left: 0,
+    right: 0,
+  },
+
+
+
+  skeletonCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginHorizontal: 16, marginBottom: 12, gap: 10 },
+  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: '#e2e8f0' },
+  errorBanner: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
+  errorBannerText: { flex: 1, color: '#991b1b', fontSize: 13, fontWeight: '700', textAlign: 'right' },
+  errorRetryBtn: { backgroundColor: '#dc2626', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
+  errorRetryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
+  loadMoreBtn: { alignSelf: 'center', marginVertical: 14, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
+  loadMoreText: { color: '#047857', fontWeight: '800', fontSize: 13 },
+  heroGreeting: { color: '#d1fae5', fontSize: 14, fontWeight: '800', textAlign: 'right', marginTop: 10, marginBottom: 2 },
+});
diff --git a/hooks/useHomeFeed.ts b/hooks/useHomeFeed.ts
new file mode 100644
index 0000000..549c62e
--- /dev/null
+++ b/hooks/useHomeFeed.ts
@@ -0,0 +1,237 @@
+import { useCallback, useEffect, useRef, useState } from 'react';
+import { router, useFocusEffect } from 'expo-router';
+import { supabase } from '@/lib/supabase';
+import {
+  getActiveLocation,
+  setActiveLocation,
+  isAllKingdom,
+  type HaynaLocation,
+} from '@/lib/locationSync';
+import {
+  dedupe,
+  type HelpRequest,
+  type Profile,
+  type Question,
+  type Story,
+} from '@/lib/homeUtils';
+
+const PAGE_SIZE = 30;
+
+type Options = {
+  /** Called whenever the effective location was resolved from profile / storage. */
+  onLocation: (loc: HaynaLocation) => void;
+};
+
+export function useHomeFeed({ onLocation }: Options) {
+  const [profile, setProfile] = useState<Profile | null>(null);
+  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
+  const [questions, setQuestions] = useState<Question[]>([]);
+  const [requests, setRequests] = useState<HelpRequest[]>([]);
+  const [stories, setStories] = useState<Story[]>([]);
+  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
+
+  const [loading, setLoading] = useState(true); // first load only
+  const [error, setError] = useState<string | null>(null);
+  const [hasMore, setHasMore] = useState(false);
+  const [loadingMore, setLoadingMore] = useState(false);
+  const [locationIncomplete, setLocationIncomplete] = useState(false);
+
+  const busyRef = useRef(false);
+  const limitRef = useRef(PAGE_SIZE);
+  const locRef = useRef<HaynaLocation | null>(null);
+  const onLocationRef = useRef(onLocation);
+  onLocationRef.current = onLocation;
+
+  const load = useCallback(async (opts?: { more?: boolean }) => {
+    if (busyRef.current) return;
+    busyRef.current = true;
+    if (opts?.more) {
+      limitRef.current += PAGE_SIZE;
+      setLoadingMore(true);
+    }
+
+    try {
+      const { data: auth, error: authError } = await supabase.auth.getUser();
+      if (authError) throw authError;
+      const user = auth.user;
+      if (!user) {
+        router.replace('/auth');
+        return;
+      }
+      setCurrentUserId(user.id);
+
+      const [profileRes, savedLoc] = await Promise.all([
+        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
+        getActiveLocation(),
+      ]);
+      if (profileRes.error) throw profileRes.error;
+
+      const profileData = profileRes.data as Profile | null;
+      const loc: HaynaLocation =
+        profileData?.city && isAllKingdom(savedLoc.city)
+          ? {
+              region: profileData.region || 'المملكة',
+              city: profileData.city,
+              district: profileData.district || 'كل الأحياء',
+            }
+          : savedLoc;
+
+      locRef.current = loc;
+      setProfile(profileData);
+      onLocationRef.current(loc);
+      setLocationIncomplete(!(profileData?.region && profileData?.city && profileData?.district));
+
+      if (profileData?.city && isAllKingdom(savedLoc.city)) {
+        void setActiveLocation(loc.region, loc.city, loc.district, false);
+      }
+
+      const limit = limitRef.current;
+
+      // Stage 1: every independent query in parallel.
+      const [notifRes, storiesRes, questionsRes, requestsRes] = await Promise.all([
+        supabase
+          .from('notifications')
+          .select('id', { count: 'exact', head: true })
+          .eq('user_id', user.id)
+          .is('read_at', null),
+        supabase
+          .from('stories')
+          .select(
+            '*, profiles:author_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district)',
+          )
+          .gt('expires_at', new Date().toISOString())
+          .order('created_at', { ascending: false })
+          .limit(30),
+        supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(limit),
+        supabase
+          .from('requests')
+          .select('*')
+          .eq('status', 'open')
+          .order('created_at', { ascending: false })
+          .limit(limit),
+      ]);
+
+      setUnreadNotifCount(notifRes.count ?? 0);
+
+      if (questionsRes.error) throw questionsRes.error;
+      if (requestsRes.error) throw requestsRes.error;
+
+      // Stories: one per author, limited to the user's area.
+      const seen = new Set<string>();
+      setStories(
+        ((storiesRes.data ?? []) as Story[]).filter(s => {
+          if (!s.author_id || seen.has(s.author_id)) return false;
+          const c = s.profiles?.city || '';
+          const d = s.profiles?.district || '';
+          if (!isAllKingdom(loc.city)) {
+            if (loc.city && c && c !== loc.city) return false;
+            if (loc.district && loc.district !== 'كل الأحياء' && d && d !== loc.district) return false;
+          }
+          seen.add(s.author_id);
+          return true;
+        }),
+      );
+
+      const qRows = dedupe((questionsRes.data ?? []) as Question[], 'author_id');
+      const rRows = dedupe((requestsRes.data ?? []) as HelpRequest[], 'requester_id');
+      setHasMore((questionsRes.data?.length ?? 0) >= limit || (requestsRes.data?.length ?? 0) >= limit);
+
+      // Stage 2: answers + ONE profiles query for every author involved.
+      const qIds = qRows.map(q => q.id);
+      const answersRes = qIds.length
+        ? await supabase.from('answers').select('*').in('question_id', qIds).order('created_at', { ascending: true })
+        : { data: [] as any[], error: null };
+      const answers = (answersRes.data ?? []) as any[];
+
+      const profileIds = [
+        ...new Set([
+          ...qRows.map(q => q.author_id),
+          ...rRows.map(r => r.requester_id),
+          ...answers.map(a => a.author_id),
+        ].filter(Boolean)),
+      ] as string[];
+
+      const profilesRes = profileIds.length
+        ? await supabase.from('profiles').select('*').in('id', profileIds)
+        : { data: [] as any[] };
+      const profileMap: Record<string, Profile> = {};
+      (profilesRes.data ?? []).forEach((p: any) => { profileMap[p.id] = p; });
+
+      const answersByQ: Record<string, any[]> = {};
+      answers.forEach(a => {
+        (answersByQ[a.question_id] ||= []).push({ ...a, profiles: profileMap[a.author_id] || null });
+      });
+
+      setQuestions(
+        qRows.map(q => ({
+          ...q,
+          profiles: profileMap[q.author_id] || null,
+          answers: answersByQ[q.id] || [],
+          answers_count: (answersByQ[q.id] || []).length,
+        })),
+      );
+      setRequests(rRows.map(r => ({ ...r, profiles: profileMap[r.requester_id] || null })));
+      setError(null);
+    } catch (e: any) {
+      console.warn('home load failed:', e);
+      setError(e?.message ? 'تعذر تحميل الصفحة، تحقق من الاتصال وحاول مرة أخرى.' : 'حدث خطأ غير متوقع.');
+    } finally {
+      busyRef.current = false;
+      setLoading(false);
+      setLoadingMore(false);
+    }
+  }, []);
+
+  useFocusEffect(
+    useCallback(() => {
+      void load();
+    }, [load]),
+  );
+
+  // Realtime: new posts refresh the feed (debounced), new notifications bump the badge.
+  useEffect(() => {
+    if (!currentUserId) return;
+    let timer: ReturnType<typeof setTimeout> | null = null;
+    const refresh = () => {
+      if (timer) clearTimeout(timer);
+      timer = setTimeout(() => void load(), 1500);
+    };
+
+    const channel = supabase
+      .channel(`home-live-${currentUserId}`)
+      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, refresh)
+      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, refresh)
+      .on(
+        'postgres_changes',
+        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
+        () => setUnreadNotifCount(c => c + 1),
+      )
+      .subscribe();
+
+    return () => {
+      if (timer) clearTimeout(timer);
+      void supabase.removeChannel(channel);
+    };
+  }, [currentUserId, load]);
+
+  const loadMore = useCallback(() => load({ more: true }), [load]);
+  const reload = useCallback(() => load(), [load]);
+
+  return {
+    profile,
+    setProfile,
+    currentUserId,
+    questions,
+    setQuestions,
+    requests,
+    stories,
+    unreadNotifCount,
+    loading,
+    loadingMore,
+    error,
+    hasMore,
+    locationIncomplete,
+    reload,
+    loadMore,
+  };
+}
diff --git a/hooks/useHomeLocation.ts b/hooks/useHomeLocation.ts
new file mode 100644
index 0000000..8b6aa3b
--- /dev/null
+++ b/hooks/useHomeLocation.ts
@@ -0,0 +1,197 @@
+import { useCallback, useEffect, useRef, useState } from 'react';
+import AsyncStorage from '@react-native-async-storage/async-storage';
+import { supabase } from '@/lib/supabase';
+import {
+  getActiveLocation,
+  savePermanentMyLocation,
+  subscribeLocation,
+  isExactDistrictMatching,
+  type HaynaLocation,
+} from '@/lib/locationSync';
+import { CurrentWeather, loadCurrentWeather } from '@/lib/weather';
+import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
+import { registerPushToken } from '@/lib/notifications';
+import type { Profile } from '@/lib/homeUtils';
+
+const LAST_CHECK_KEY = '@hayna_location_last_auto_check_v1';
+const SNOOZE_KEY = '@hayna_location_prompt_snooze_v1';
+const WEEK = 7 * 24 * 60 * 60 * 1000;
+const DAY = 24 * 60 * 60 * 1000;
+const WEATHER_REFRESH = 30 * 60 * 1000;
+
+type Options = {
+  setProfile: (updater: (current: Profile | null) => Profile) => void;
+  showToast: (msg: string) => void;
+};
+
+export function useHomeLocation({ setProfile, showToast }: Options) {
+  const [region, setRegion] = useState('كل المملكة');
+  const [city, setCity] = useState('كل المدن');
+  const [district, setDistrict] = useState('كل الأحياء');
+  const [ready, setReady] = useState(false);
+
+  const [weather, setWeather] = useState<CurrentWeather | null>(null);
+  const [weatherLoading, setWeatherLoading] = useState(false);
+
+  const [setupOpen, setSetupOpen] = useState(false);
+  const [setupBusy, setSetupBusy] = useState(false);
+  const [setupMessage, setSetupMessage] = useState('');
+  const [promptVisible, setPromptVisible] = useState(false);
+
+  const apply = useCallback((loc: HaynaLocation) => {
+    setRegion(loc.region);
+    setCity(loc.city);
+    setDistrict(loc.district);
+  }, []);
+
+  // Initial + live location sync
+  useEffect(() => {
+    let active = true;
+    getActiveLocation().then(loc => {
+      if (!active) return;
+      apply(loc);
+      setReady(true);
+    });
+    const unsub = subscribeLocation(apply);
+    return () => { active = false; unsub(); };
+  }, [apply]);
+
+  // Weather: refresh on location change and every 30 min
+  useEffect(() => {
+    if (!ready) return;
+    let active = true;
+    const update = async () => {
+      setWeatherLoading(true);
+      try {
+        const w = await loadCurrentWeather(region, city, district);
+        if (active) setWeather(w);
+      } catch (e) {
+        console.warn('Weather update failed', e);
+        if (active) setWeather(null);
+      } finally {
+        if (active) setWeatherLoading(false);
+      }
+    };
+    void update();
+    const id = setInterval(update, WEATHER_REFRESH);
+    return () => { active = false; clearInterval(id); };
+  }, [ready, region, city, district]);
+
+  // Weekly location check (with a 24h snooze so the prompt never loops)
+  useEffect(() => {
+    let active = true;
+    (async () => {
+      const [lastRaw, snoozeRaw] = await Promise.all([
+        AsyncStorage.getItem(LAST_CHECK_KEY),
+        AsyncStorage.getItem(SNOOZE_KEY),
+      ]);
+      const last = Number(lastRaw) || 0;
+      const snoozedUntil = Number(snoozeRaw) || 0;
+      const due = !last || Date.now() - last >= WEEK;
+      if (active && due && Date.now() > snoozedUntil) setPromptVisible(true);
+    })();
+    return () => { active = false; };
+  }, []);
+
+  const resolveLiveLocation = useCallback(async () => {
+    const device = await getCurrentDeviceLocation();
+    if (!device) return null;
+    const place = await reverseGeocodeDeviceLocation(device);
+    const live = {
+      region: place?.region?.trim() || '',
+      city: place?.city?.trim() || '',
+      district: place?.district?.trim() || '',
+    };
+    return live.region && live.city && live.district ? live : null;
+  }, []);
+
+  const persistLocation = useCallback(async (live: HaynaLocation) => {
+    await savePermanentMyLocation(live, true);
+    apply(live);
+    setProfile(current => ({ ...(current || ({} as Profile)), ...live }));
+  }, [apply, setProfile]);
+
+  const snoozePrompt = useCallback(async () => {
+    setPromptVisible(false);
+    await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY));
+  }, []);
+
+  const acceptWeeklyCheck = useCallback(async () => {
+    setPromptVisible(false);
+    try {
+      const { data } = await supabase.auth.getUser();
+      if (!data.user) return;
+      const live = await resolveLiveLocation();
+      if (!live) throw new Error('no-location');
+      await persistLocation(live);
+      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
+      showToast('تم تحديث موقعك ✓');
+    } catch (e) {
+      console.warn('weekly location check failed:', e);
+      await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY));
+      showToast('تعذر تحديد موقعك، سنحاول لاحقاً. يمكنك التحديث من الملف الشخصي.');
+    }
+  }, [persistLocation, resolveLiveLocation, showToast]);
+
+  const setupRequiredLocation = useCallback(async () => {
+    if (setupBusy) return;
+    setSetupBusy(true);
+    setSetupMessage('جارٍ تحديد موقعك وقراءة المنطقة والمدينة والحي…');
+    try {
+      const live = await resolveLiveLocation();
+      if (!live) {
+        setSetupMessage('لم نتمكن من تحديد المنطقة والمدينة والحي بدقة. فعّل إذن الموقع ثم حاول مرة أخرى.');
+        return;
+      }
+      await persistLocation(live);
+      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
+      setSetupMessage('تم حفظ موقعك. نطلب الآن تفعيل الإشعارات حتى لا تفوتك تنبيهات الحي…');
+      const token = await registerPushToken();
+      setSetupOpen(false);
+      showToast(
+        token
+          ? 'تم ربط حسابك بموقعك وتفعيل الإشعارات ✓'
+          : 'تم حفظ موقعك. يمكنك تفعيل الإشعارات لاحقاً من الإعدادات.',
+      );
+    } catch (e: any) {
+      setSetupMessage(e?.message || 'تعذر إكمال الإعداد. حاول مرة أخرى.');
+    } finally {
+      setSetupBusy(false);
+    }
+  }, [setupBusy, resolveLiveLocation, persistLocation, showToast]);
+
+  const enableNotifications = useCallback(async () => {
+    if (setupBusy) return;
+    setSetupBusy(true);
+    setSetupMessage('جارٍ طلب إذن الإشعارات…');
+    try {
+      const token = await registerPushToken();
+      setSetupOpen(false);
+      showToast(
+        token
+          ? 'تم تفعيل إشعارات حيّك ✓'
+          : 'تم الدخول. الإشعارات غير مفعلة ويمكن تفعيلها لاحقاً من الإعدادات.',
+      );
+    } finally {
+      setSetupBusy(false);
+    }
+  }, [setupBusy, showToast]);
+
+  const hasExactLocation =
+    city !== 'كل المدن' && district !== 'كل الأحياء' && district !== 'كل أحياء المدينة';
+
+  const matchesLocation = useCallback(
+    (item: { city?: string | null; district?: string | null }) => isExactDistrictMatching(item, city, district),
+    [city, district],
+  );
+
+  return {
+    region, city, district, ready, apply,
+    weather, weatherLoading,
+    setupOpen, setSetupOpen, setupBusy, setupMessage,
+    promptVisible, snoozePrompt, acceptWeeklyCheck,
+    setupRequiredLocation, enableNotifications,
+    hasExactLocation, matchesLocation,
+    persistLocation,
+  };
+}
diff --git a/lib/homeUtils.ts b/lib/homeUtils.ts
new file mode 100644
index 0000000..4148257
--- /dev/null
+++ b/lib/homeUtils.ts
@@ -0,0 +1,133 @@
+export type HomeTab = 'all' | 'emergency' | 'tools' | 'questions' | 'requests' | 'mine';
+
+export type Profile = {
+  id: string;
+  display_name?: string | null;
+  username?: string | null;
+  avatar_url?: string | null;
+  is_verified?: boolean | null;
+  is_geoverified?: boolean | null;
+  region?: string | null;
+  city?: string | null;
+  district?: string | null;
+  [key: string]: any;
+};
+
+export type Answer = {
+  id: string;
+  question_id: string;
+  author_id: string;
+  body: string;
+  created_at: string;
+  profiles?: Profile | null;
+  [key: string]: any;
+};
+
+export type Question = {
+  id: string;
+  author_id: string;
+  title: string;
+  body?: string | null;
+  city?: string | null;
+  district?: string | null;
+  category?: string | null;
+  is_emergency?: boolean | null;
+  urgency_level?: string | null;
+  is_tool_sharing?: boolean | null;
+  item_type?: string | null;
+  created_at: string;
+  profiles?: Profile | null;
+  answers?: Answer[];
+  answers_count?: number;
+  [key: string]: any;
+};
+
+export type HelpRequest = {
+  id: string;
+  requester_id: string;
+  title: string;
+  description?: string | null;
+  city?: string | null;
+  district?: string | null;
+  category?: string | null;
+  status?: string;
+  created_at: string;
+  profiles?: Profile | null;
+  [key: string]: any;
+};
+
+export type Story = {
+  id: string;
+  author_id: string;
+  type?: string | null;
+  content?: string | null;
+  bg_color?: string | null;
+  created_at: string;
+  expires_at: string;
+  profiles?: Profile | null;
+  [key: string]: any;
+};
+
+export type FeedItem =
+  | { type: 'question'; data: Question }
+  | { type: 'request'; data: HelpRequest };
+
+export function normalizeSearchText(value: unknown): string {
+  return String(value ?? '')
+    .normalize('NFKD')
+    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
+    .replace(/[أإآٱ]/g, 'ا')
+    .replace(/ى/g, 'ي')
+    .replace(/ة/g, 'ه')
+    .toLocaleLowerCase('ar')
+    .trim()
+    .replace(/\s+/g, ' ');
+}
+
+export function getGreeting(date = new Date()): string {
+  const h = date.getHours();
+  if (h >= 4 && h < 12) return 'صباح الخير';
+  if (h >= 12 && h < 17) return 'طاب يومك';
+  if (h >= 17 && h < 21) return 'مساء الخير';
+  return 'مساء النور';
+}
+
+const EMERGENCY_WORDS = ['مفقود', 'طارئ', 'حادث', 'حريق', 'اسعاف', 'إسعاف'];
+const TOOL_WORDS = ['إعارة', 'اعارة', 'دريل', 'سلم', 'عدة', 'معدات'];
+
+const hasWord = (text: unknown, words: string[]) => {
+  const t = normalizeSearchText(text);
+  return words.some(w => t.includes(normalizeSearchText(w)));
+};
+
+export function isEmergencyQuestion(q: Question): boolean {
+  return !!q.is_emergency || q.urgency_level === 'emergency' || hasWord(q.title, EMERGENCY_WORDS);
+}
+
+export function isToolQuestion(q: Question): boolean {
+  return !!q.is_tool_sharing || q.item_type === 'tool_sharing' || q.item_type === 'borrow' || hasWord(q.title, TOOL_WORDS);
+}
+
+/** Removes only true duplicates: same id, or same author posting the same title twice. */
+export function dedupe<T extends { id: string; title?: string | null }>(
+  rows: T[],
+  authorKey: 'author_id' | 'requester_id',
+): T[] {
+  const ids = new Set<string>();
+  const sig = new Set<string>();
+  return rows.filter((row: any) => {
+    if (ids.has(row.id)) return false;
+    const s = `${row[authorKey] ?? ''}|${normalizeSearchText(row.title)}`;
+    if (sig.has(s)) return false;
+    ids.add(row.id);
+    sig.add(s);
+    return true;
+  });
+}
+
+export function toFeed(questions: Question[], requests: HelpRequest[]): FeedItem[] {
+  return [
+    ...questions.map(data => ({ type: 'question' as const, data })),
+    ...requests.map(data => ({ type: 'request' as const, data })),
+  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());
+}
