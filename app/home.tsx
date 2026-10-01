import { useCallback, useState, useEffect, useRef } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle,
  Truck,
  MapPin,
  Briefcase,
  Plus,
  Sparkles,
  Map,
  AlertTriangle,
  Bell,
  Search,
  Flame,
  CloudSun,
  Heart,
  Share2,
  MoreHorizontal,
  User,
  Mic,
  ChevronLeft,
  Zap,
  ChevronDown,
  ChevronUp,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Repeat,
  Bookmark,
  Send,
  Eye,
  CornerDownLeft,
  Check,
} from 'lucide-react-native';
import { C } from '@/lib/ui';
import BottomNav from '@/components/BottomNav';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { generateNeighborhoodPulseAI } from '@/lib/aiAssistant';
import { useDynamicIsland } from '@/context/DynamicIslandContext';

const { width } = Dimensions.get('window');

// Relative time in Arabic helper
function formatArabicTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} د`;
  if (diffHour < 24) return `منذ ${diffHour} س`;
  if (diffDay === 1) return 'أمس';
  if (diffDay < 7) return `منذ ${diffDay} أيام`;
  return past.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

export default function Home() {
  const { showIsland } = useDynamicIsland();
  const [profile, setProfile] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'emergency' | 'tools' | 'questions' | 'requests'>('all');
  const [greeting, setGreeting] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Location filter state
  const [selectedRegion, setSelectedRegion] = useState('كل المملكة');
  const [selectedCity, setSelectedCity] = useState('كل المدن');
  const [selectedDistrict, setSelectedDistrict] = useState('كل الأحياء');
  const [showLocationModal, setShowLocationModal] = useState(false);


  // Unread badge count
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // AI Pulse card expansion
  const [pulseExpanded, setPulseExpanded] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Animation for FAB
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const showToast = useCallback((msg: string) => {
    showIsland(msg, undefined, 'success');
  }, [showIsland]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير ☀️');
    else if (hour < 18) setGreeting('مساء الخير 🌤️');
    else setGreeting('مساء الخير 🌙');

    // Start FAB Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');

    // Fetch profile
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle();
    setProfile(profileData);

    // If user has a city in profile and selectedCity is still default, auto-populate
    if (profileData?.city && selectedCity === 'كل المدن') {
      setSelectedCity(profileData.city);
      if (profileData.district) setSelectedDistrict(profileData.district);
    }

    // Fetch unread notifications
    const { count: nc } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.user.id)
      .is('read_at', null);
    setUnreadNotifCount(nc ?? 0);

    // Fetch stories (active, last 24h) and deduplicate by author
    const { data: storiesData } = await supabase
      .from('stories')
      .select('*, profiles:author_id(id, display_name, username, avatar_url, is_verified, is_geoverified)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    const seenStoryAuthors = new Set<string>();
    const uniqueStories = (storiesData ?? []).filter((s: any) => {
      if (!s.author_id || seenStoryAuthors.has(s.author_id)) return false;
      seenStoryAuthors.add(s.author_id);
      return true;
    });
    setStories(uniqueStories);

    // Fetch questions and deduplicate by title
    const { data: qData, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (qErr) console.log('questions error:', qErr.message);

    if (qData && qData.length > 0) {
      const seenTitles = new Set<string>();
      const uniqueQData = qData.filter((q: any) => {
        const t = (q.title || '').trim().toLowerCase();
        if (seenTitles.has(t)) return false;
        seenTitles.add(t);
        return true;
      });

      const authorIds = [...new Set(uniqueQData.map((q: any) => q.author_id).filter(Boolean))];
      const qIds = uniqueQData.map((q: any) => q.id);

      // Fetch profiles of question authors and answers in parallel
      const [profilesRes, answersRes] = await Promise.all([
        supabase.from('profiles').select('*').in('id', authorIds),
        supabase.from('answers').select('*').in('question_id', qIds).order('created_at', { ascending: true })
      ]);

      const profileMap = (profilesRes.data || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});

      // Fetch profiles of answer authors
      const answerAuthorIds = [...new Set((answersRes.data || []).map((a: any) => a.author_id).filter(Boolean))];
      let ansProfileMap: Record<string, any> = {};
      if (answerAuthorIds.length > 0) {
        const { data: ansProfiles } = await supabase.from('profiles').select('*').in('id', answerAuthorIds);
        ansProfileMap = (ansProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      }

      // Group answers by question_id
      const answersByQ: Record<string, any[]> = {};
      (answersRes.data || []).forEach((ans: any) => {
        ans.profiles = ansProfileMap[ans.author_id] || null;
        if (!answersByQ[ans.question_id]) answersByQ[ans.question_id] = [];
        answersByQ[ans.question_id].push(ans);
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

    // Fetch requests and deduplicate by title
    const { data: rData, error: rErr } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(25);

    if (rErr) console.log('requests error:', rErr.message);

    if (rData && rData.length > 0) {
      const seenReqTitles = new Set<string>();
      const uniqueRData = rData.filter((r: any) => {
        const t = (r.title || '').trim().toLowerCase();
        if (seenReqTitles.has(t)) return false;
        seenReqTitles.add(t);
        return true;
      });

      const requesterIds = [...new Set(uniqueRData.map((r: any) => r.requester_id).filter(Boolean))];
      const { data: rProfiles } = await supabase.from('profiles').select('*').in('id', requesterIds);
      const profileMap = (rProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      setRequests(uniqueRData.map((r: any) => ({ ...r, profiles: profileMap[r.requester_id] || null })));
    } else {
      setRequests([]);
    }
  }, [selectedCity]);

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

    showToast('تم نشر ردك بنجاح في المحادثة ✨');
  };

  // Filter questions and requests by selected Saudi region / city / district & Proximity Radius
  const filteredQuestions = questions.filter(q => {
    if (searchQuery.trim()) {
      const match = (q.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (q.body || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!match) return false;
    }
    if (selectedCity === 'كل المدن') return true;
    if (selectedDistrict !== 'كل الأحياء') {
      if (q.district && !q.district.includes(selectedDistrict) && !selectedDistrict.includes(q.district)) return false;
    }
    if (q.city && !q.city.includes(selectedCity) && !selectedCity.includes(q.city)) return false;
    return true;
  });

  const filteredRequests = requests.filter(r => {
    if (searchQuery.trim()) {
      const match = (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!match) return false;
    }
    if (selectedCity === 'كل المدن') return true;
    if (selectedDistrict !== 'كل الأحياء') {
      if (r.district && !r.district.includes(selectedDistrict) && !selectedDistrict.includes(r.district)) return false;
    }
    if (r.city && !r.city.includes(selectedCity) && !selectedCity.includes(r.city)) return false;
    return true;
  });

  // Emergency & Tools categorization
  const emergencyQuestions = filteredQuestions.filter(
    q => q.is_emergency || q.urgency_level === 'emergency' || (q.title && (q.title.includes('مفقود') || q.title.includes('طارئ') || q.title.includes('حادث')))
  );

  const toolQuestions = filteredQuestions.filter(
    q => q.is_tool_sharing || q.item_type === 'tool_sharing' || (q.title && (q.title.includes('إعارة') || q.title.includes('دريل') || q.title.includes('سلم')))
  );
  // Dynamic AI Neighborhood Pulse
  const neighborhoodPulse = generateNeighborhoodPulseAI(
    selectedCity,
    selectedDistrict,
    filteredQuestions.length || 15
  );

  return (
    <View style={styles.container}>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => { 
              setRefreshing(true); 
              await load(); 
              setRefreshing(false); 
            }} 
            tintColor="#0891b2" 
          />
        }
      >
        {/* ======================================================== */}
        {/* 1. ULTRA-SLEEK MODERN HEADER                            */}
        {/* ======================================================== */}
        <LinearGradient 
          colors={['#0891b2', '#0284c7', '#0369a1']} 
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
                <Text style={styles.heroBrandTitle}>حيّنا</Text>
                <Text style={styles.brandKsaFlag}>🇸🇦</Text>
              </View>

              {/* Location Selector Pill */}
              <Pressable
                style={styles.locationSelectorPill}
                onPress={() => setShowLocationModal(true)}
              >
                <ChevronDown size={14} color="#67e8f9" />
                <Text style={styles.locationSelectorText} numberOfLines={1}>
                  {selectedCity === 'كل المدن'
                    ? '🇸🇦 كل مناطق المملكة'
                    : `${selectedCity}${selectedDistrict !== 'كل الأحياء' ? ` · حي ${selectedDistrict}` : ''}`}
                </Text>
                <MapPin size={13} color="#38bdf8" />
              </Pressable>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#94a3b8" />
              <TextInput 
                placeholder="ابحث عن استفسار، توصية، أو جار في حيك..." 
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.micBtn} onPress={() => router.push('/questions')}>
                  <Mic size={17} color="#0891b2" />
                </Pressable>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ======================================================== */}
        {/* 2. NEIGHBORHOOD STORIES (يوميات الحي)                     */}
        {/* ======================================================== */}
        <View style={styles.storiesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
            {/* Add Story Button */}
            <Pressable style={styles.storyBox} onPress={() => router.push('/create-story')}>
              <LinearGradient colors={['#0891b2', '#06b6d4']} style={styles.storyAddRing}>
                <View style={styles.storyAddBtn}>
                  <Plus size={22} color="#0891b2" />
                </View>
              </LinearGradient>
              <Text style={styles.storyName}>يومياتي</Text>
            </Pressable>

            {/* Real Stories from DB */}
            {stories.map((story) => {
              const authorName = story.profiles?.display_name || story.profiles?.username || 'جار';
              const avatarUrl = story.profiles?.avatar_url;
              const isVerified = story.profiles?.is_verified;
              const isGeoVerified = story.profiles?.is_geoverified;
              return (
                <Pressable key={story.id} style={styles.storyBox} onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}>
                  <View style={[styles.storyRing, { borderColor: story.bg_color || '#0891b2' }]}>
                    {story.type === 'text' ? (
                      <View style={[styles.storyTextPreview, { backgroundColor: story.bg_color || '#0891b2' }]}>
                        <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>
                          {story.content?.[0] || 'ق'}
                        </Text>
                      </View>
                    ) : avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.storyImg} />
                    ) : (
                      <View style={[styles.storyTextPreview, { backgroundColor: story.bg_color || '#0891b2' }]}>
                        <Text style={styles.storyTextPreviewLetter}>{authorName[0]}</Text>
                      </View>
                    )}
                    {(isVerified || isGeoVerified) && (
                      <View style={styles.storyVerifiedTag}>
                        <ShieldCheck size={9} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>{authorName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ======================================================== */}
        {/* 3. SMART NEIGHBORHOOD HUB (AI Pulse & Distance Filter)   */}
        {/* ======================================================== */}
        <View style={styles.hubCard}>
          {/* Top Hub Row: AI Pulse Header */}
          <View style={styles.hubHeader}>
            <View style={styles.hubSolvedBadge}>
              <Text style={styles.hubSolvedText}>نسبة الحل {neighborhoodPulse.solvedRate}</Text>
            </View>
            <Pressable
              style={styles.hubTitleRow}
              onPress={() => setPulseExpanded(!pulseExpanded)}
            >
              <Text style={styles.hubTitle}>{neighborhoodPulse.headline}</Text>
              <Sparkles size={16} color="#0891b2" />
              {pulseExpanded ? <ChevronUp size={16} color="#0891b2" /> : <ChevronDown size={16} color="#0891b2" />}
            </Pressable>
          </View>

          {pulseExpanded && (
            <View style={styles.hubExpandedBody}>
              <Text style={styles.hubSummaryText}>{neighborhoodPulse.smartSummary}</Text>
              
              {/* Trending Topics Tags */}
              <View style={styles.hubTopicsRow}>
                {neighborhoodPulse.trendingTopics.map((topic, i) => (
                  <Pressable 
                    key={i} 
                    style={styles.hubTopicPill}
                    onPress={() => setSearchQuery(topic)}
                  >
                    <Text style={styles.hubTopicText}>🔥 {topic}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Neighborhood Smart Newsletter */}
          <View style={styles.newsletterCard}>
            <View style={styles.newsletterHeader}>
              <Text style={styles.newsletterTitle}>نشرة حي {selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'كل الأحياء'} الذكية لهذا الأسبوع 📰</Text>
              <View style={styles.newsletterBadge}>
                <Text style={styles.newsletterBadgeText}>نسبة الحل 96%</Text>
              </View>
            </View>
            <Text style={styles.newsletterDesc}>
              شهد حي {selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'كل الأحياء'} هذا الأسبوع نشاطاً مميزاً بتفاعل أكثر من 132 جار، مع حل 96% من الاستفسارات وتبادل 8 أدوات ومعدات صيانة مجاناً بين الأهالي.
            </Text>
            <View style={styles.newsletterTrends}>
              <Text style={styles.trendItem}>🔥 استعدادات وصيانة التكييف قبل موسم الحر</Text>
              <Text style={styles.trendItem}>🔥 تبادل أدوات الصيانة المنزلية في سوق الحي المصغر</Text>
              <Text style={styles.trendItem}>🔥 تجمع رياضي مسائي في ممشى الحي وحديقته</Text>
            </View>
          </View>
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
                <Text style={styles.emergencyHomeTitle}>تنبيه طارئ عاجل في الحي 🚨</Text>
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
            icon={<MessageCircle size={22} color="#0284c7" />} 
            bg="#f0f9ff" 
            label="استفسارات" 
            onPress={() => {
              setActiveTab('questions');
              showToast('عرض جميع استفسارات وتجارب الجيران 💬');
            }} 
          />
          <ServicePill 
            icon={<Wrench size={22} color="#16a34a" />} 
            bg="#f0fdf4" 
            label="إعارة أدوات" 
            onPress={() => {
              setActiveTab('tools');
              showToast('أدوات ومعدات متاحة للإعارة بين الجيران 🛠️');
            }} 
          />
          <ServicePill 
            icon={<Briefcase size={22} color="#7c3aed" />} 
            bg="#faf5ff" 
            label="خدمات الحي" 
            onPress={() => router.push('/services')} 
          />
          <ServicePill 
            icon={<Truck size={22} color="#d97706" />} 
            bg="#fffbeb" 
            label="فزعة وطلبات" 
            onPress={() => router.push('/requests')} 
          />
          <ServicePill 
            icon={<MapPin size={22} color="#0d9488" />} 
            bg="#f0fdfa" 
            label="دليل المحلات" 
            onPress={() => router.push('/directory')} 
          />
          <ServicePill 
            icon={<Map size={22} color="#0891b2" />} 
            bg="#ecfeff" 
            label="رادار الخريطة" 
            onPress={() => router.push('/map')} 
          />
        </View>

        {/* ======================================================== */}
        {/* AUDIO SPACES ROW (مجالس الحي الصوتية)                    */}
        {/* ======================================================== */}
        <View style={styles.spacesSection}>
          <Text style={styles.spacesHeaderTitle}>مجالس الحي الصوتية 🎙️</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spacesScroll}>
            {/* Space Card 1 */}
            <Pressable style={[styles.spaceCard, { backgroundColor: '#4f46e5' }]} onPress={() => showIsland('جاري الانضمام للمجلس...', undefined, 'info')}>
              <View style={styles.spaceCardTop}>
                <View style={styles.spaceLiveBadge}>
                  <Text style={styles.spaceLiveText}>مباشر</Text>
                </View>
                <Text style={styles.spaceHostText}>بواسطة أبو خالد</Text>
              </View>
              <Text style={styles.spaceTitle}>نقاش: خطط التشجير في حي الياسمين 🌳</Text>
              <View style={styles.spaceCardBottom}>
                <View style={styles.spaceAvatarsRow}>
                  <View style={[styles.spaceAvatarMini, { zIndex: 3 }]} />
                  <View style={[styles.spaceAvatarMini, { zIndex: 2, marginLeft: -10 }]} />
                  <View style={[styles.spaceAvatarMini, { zIndex: 1, marginLeft: -10 }]} />
                </View>
                <Text style={styles.spaceListenersText}>+24 يستمعون</Text>
              </View>
            </Pressable>

            {/* Space Card 2 */}
            <Pressable style={[styles.spaceCard, { backgroundColor: '#be185d' }]} onPress={() => showIsland('جاري الانضمام للمجلس...', undefined, 'info')}>
              <View style={styles.spaceCardTop}>
                <View style={styles.spaceLiveBadge}>
                  <Text style={styles.spaceLiveText}>مباشر</Text>
                </View>
                <Text style={styles.spaceHostText}>بواسطة أم فهد</Text>
              </View>
              <Text style={styles.spaceTitle}>تجمع أمهات الحي لتبادل الخبرات ☕</Text>
              <View style={styles.spaceCardBottom}>
                <View style={styles.spaceAvatarsRow}>
                  <View style={[styles.spaceAvatarMini, { zIndex: 3 }]} />
                  <View style={[styles.spaceAvatarMini, { zIndex: 2, marginLeft: -10 }]} />
                </View>
                <Text style={styles.spaceListenersText}>+12 يستمعون</Text>
              </View>
            </Pressable>
          </ScrollView>
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
              <Text style={[styles.fTabText, activeTab === 'all' && styles.fTabTextActive]}>الكل</Text>
            </Pressable>

            {emergencyQuestions.length > 0 && (
              <Pressable 
                style={[styles.fTab, activeTab === 'emergency' && styles.fTabActiveRed]} 
                onPress={() => setActiveTab('emergency')}
              >
                <Text style={[styles.fTabText, activeTab === 'emergency' && styles.fTabTextActive]}>
                  🚨 طوارئ ({emergencyQuestions.length})
                </Text>
              </Pressable>
            )}

            <Pressable 
              style={[styles.fTab, activeTab === 'tools' && styles.fTabActiveGreen]} 
              onPress={() => setActiveTab('tools')}
            >
              <Text style={[styles.fTabText, activeTab === 'tools' && styles.fTabTextActive]}>
                🛠️ إعارة أدوات ({toolQuestions.length})
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.fTab, activeTab === 'questions' && styles.fTabActive]} 
              onPress={() => setActiveTab('questions')}
            >
              <Text style={[styles.fTabText, activeTab === 'questions' && styles.fTabTextActive]}>
                💬 استفسارات ({filteredQuestions.length})
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.fTab, activeTab === 'requests' && styles.fTabActive]} 
              onPress={() => setActiveTab('requests')}
            >
              <Text style={[styles.fTabText, activeTab === 'requests' && styles.fTabTextActive]}>
                🤝 فزعة ({filteredRequests.length})
              </Text>
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
              onQuickReply={handleQuickReplySubmit}
              onToast={showToast}
            />
          ))}

          {/* Empty States */}
          {activeTab === 'all' && filteredQuestions.length === 0 && filteredRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Sparkles size={36} color="#0891b2" />
              </View>
              <Text style={styles.emptyTitle}>
                {selectedCity === 'كل المدن' ? 'لا توجد استفسارات حالياً' : `لا توجد استفسارات في ${selectedCity} حالياً`}
              </Text>
              <Text style={styles.emptySub}>
                كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك بأسلوب خيط المحادثات.
              </Text>
              <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>اسأل أهل حيك الآن ✨</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'emergency' && emergencyQuestions.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <ShieldCheck size={36} color="#16a34a" />
              </View>
              <Text style={styles.emptyTitle}>الحمد لله، لا توجد طوارئ</Text>
              <Text style={styles.emptySub}>الحي آمن ومستقر بفضل الله.</Text>
            </View>
          )}

          {activeTab === 'tools' && toolQuestions.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Wrench size={36} color="#16a34a" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد عروض إعارة حالياً</Text>
              <Text style={styles.emptySub}>هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟</Text>
              <Pressable style={[styles.emptyAskBtn, { backgroundColor: '#16a34a' }]} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>اعرض أداة للإعارة المجانية 🛠️</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'questions' && filteredQuestions.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <MessageCircle size={36} color="#0891b2" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد استفسارات حالياً</Text>
              <Text style={styles.emptySub}>اطرح سؤالك الأول لأهل الحي وتلقى ردوداً وتوصيات مجربة.</Text>
              <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>اطرح سؤالك الآن ✨</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'requests' && filteredRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Truck size={36} color="#d97706" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد طلبات فزعة حالياً</Text>
              <Text style={styles.emptySub}>شارك جيرانك أي مساعدة تحتاجها وسيقف أهل حيك بجانبك.</Text>
            </View>
          )}

          <View style={{ height: 130 }} />
        </View>
      </ScrollView>

      {/* Floating Ask Button (above bottom nav) */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Pressable style={styles.fabBtn} onPress={() => router.push('/ask')}>
          <LinearGradient colors={['#0891b2', '#0284c7']} style={styles.fabGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
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
        }}
      />
    </View>
  );
}

// ========================================================
// HELPER COMPONENTS
// ========================================================

function ServicePill({ icon, bg, label, onPress }: { icon: any, bg: string, label: string, onPress?: () => void }) {
  return (
    <Pressable style={styles.servicePill} onPress={onPress}>
      <View style={[styles.serviceIconBox, { backgroundColor: bg }]}>
        {icon}
      </View>
      <Text style={styles.serviceLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ========================================================
// TWITTER / X STYLE PROGRESSIVE INQUIRY CARD COMPONENT
// (استفسار تدريجي بتفاصيل وردود فورية تفاعلية)
// ========================================================

function TwitterInquiryCard({
  type,
  data,
  currentUserProfile,
  onQuickReply,
  onToast,
}: {
  type: 'question' | 'request';
  data: any;
  currentUserProfile: any;
  onQuickReply: (id: string, text: string) => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const isReq = type === 'request';
  const name = data.profiles?.hide_name ? 'جار مجهول 🕶️' : (data.profiles?.display_name || data.profiles?.username || 'ابن الحي');
  const username = data.profiles?.username || 'neighbor';
  const avatar = data.profiles?.avatar_url;
  const isVerifiedNeighbor = data.profiles?.is_geoverified;
  const isIdVerified = data.profiles?.is_verified;
  const isEmergency = data.is_emergency || data.urgency_level === 'emergency' || (data.title && (data.title.includes('مفقود') || data.title.includes('طارئ')));
  const isToolSharing = data.is_tool_sharing || data.item_type === 'tool_sharing' || (data.title && (data.title.includes('إعارة') || data.title.includes('دريل')));

  // Progressive thread expansion state
  const [expanded, setExpanded] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // Social interactions state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 6) + 3);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(Math.floor(Math.random() * 3));
  const [bookmarked, setBookmarked] = useState(false);
  const [viewsCount] = useState(Math.floor(Math.random() * 85) + 65);

  const answers = data.answers || [];
  const answersCount = data.answers_count !== undefined ? data.answers_count : answers.length;

  // Like interaction
  function handleLike() {
    if (!liked) {
      setLiked(true);
      setLikeCount(prev => prev + 1);
      onToast('أعجبك الاستفسار ❤️');
    } else {
      setLiked(false);
      setLikeCount(prev => prev - 1);
    }
  }

  // Repost interaction
  function handleRepost() {
    if (!reposted) {
      setReposted(true);
      setRepostCount(prev => prev + 1);
      onToast('تمت إعادة نشر الاستفسار لجيرانك 🔁');
    } else {
      setReposted(false);
      setRepostCount(prev => Math.max(0, prev - 1));
      onToast('تم إلغاء إعادة النشر');
    }
  }

  // Bookmark interaction
  function handleBookmark() {
    const nextState = !bookmarked;
    setBookmarked(nextState);
    if (nextState) {
      onToast('تم حفظ الاستفسار في الإشارات المرجعية 🔖');
    } else {
      onToast('تمت إزالة الاستفسار من الإشارات المرجعية');
    }
  }

  // Share interaction
  async function handleShare() {
    const pageUrl = (Platform.OS === 'web' && typeof window !== 'undefined')
      ? `${window.location.origin}/question?id=${data.id}`
      : `https://appksa-main.vercel.app/question?id=${data.id}`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(pageUrl);
          onToast('تم نسخ رابط الاستفسار للمشاركة 🔗');
          return;
        } catch (e) {
          // fallback
        }
      }
    }
    try {
      await Share.share({
        title: data.title,
        message: `${data.title}\nشاهد التفاصيل وتفاعل مع جيرانك على منصة حيّنا:\n${pageUrl}`,
        url: pageUrl,
      });
    } catch (e) {
      onToast('تم نسخ الرابط بنجاح');
    }
  }

  // More options menu
  function handleMoreOptions() {
    Alert.alert(
      'خيارات الاستفسار',
      data.title,
      [
        { text: 'نسخ رابط المنشور', onPress: handleShare },
        { text: 'كتم إشعارات هذا المنشور', onPress: () => onToast('تم كتم إشعارات المنشور 🔕') },
        { text: 'إبلاغ عن محتوى غير لائق', onPress: () => router.push({ pathname: '/report', params: { id: data.id, type: isReq ? 'request' : 'question' } }), style: 'destructive' },
        { text: 'إلغاء', style: 'cancel' }
      ]
    );
  }

  // Quick reply submission
  async function handleSendReply() {
    if (!quickReplyText.trim()) return;
    setReplyLoading(true);
    try {
      await onQuickReply(data.id, quickReplyText);
      setQuickReplyText('');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إرسال الرد');
    } finally {
      setReplyLoading(false);
    }
  }

  // Navigate to full details page
  function navigateToDetails() {
    if (isReq) {
      router.push({ pathname: '/request', params: { id: data.id } });
    } else {
      router.push({ pathname: '/question', params: { id: data.id } });
    }
  }

  return (
    <View style={[
      styles.xCard,
      isEmergency && styles.xCardEmergency,
      isToolSharing && styles.xCardToolSharing,
    ]}>
      {/* ======================================================== */}
      {/* 1. TWITTER HEADER (Author, Verified, Time & Menu)       */}
      {/* ======================================================== */}
      <View style={styles.xHeader}>
        {/* Right side: Author Avatar with thread connector capability */}
        <Pressable 
          onPress={() => data.profiles?.id && router.push({ pathname: '/user', params: { id: data.profiles.id } })}
          style={styles.xAvatarWrap}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.xAvatarImg} />
          ) : (
            <View style={[styles.xAvatarFallback, isEmergency && { backgroundColor: '#dc2626' }]}>
              <User size={20} color="#fff" />
            </View>
          )}
          {isVerifiedNeighbor && (
            <View style={styles.xGeoBadge}>
              <ShieldCheck size={9} color="#fff" />
            </View>
          )}
        </Pressable>

        {/* Middle: Author Name, Handle, Time Ago & Neighborhood */}
        <View style={styles.xAuthorMeta}>
          <View style={styles.xAuthorRow}>
            {/* Category tag */}
            {isEmergency ? (
              <View style={styles.xEmergencyBadge}>
                <Flame size={11} color="#dc2626" />
                <Text style={styles.xEmergencyBadgeText}>عاجل</Text>
              </View>
            ) : isToolSharing ? (
              <View style={styles.xToolBadge}>
                <Wrench size={11} color="#16a34a" />
                <Text style={styles.xToolBadgeText}>إعارة</Text>
              </View>
            ) : isReq ? (
              <View style={styles.xReqBadge}>
                <Text style={styles.xReqBadgeText}>فزعة</Text>
              </View>
            ) : (
              <View style={styles.xCategoryBadge}>
                <Text style={styles.xCategoryBadgeText}>استفسار</Text>
              </View>
            )}

            <Text style={styles.xTimeAgo}>{formatArabicTimeAgo(data.created_at)}</Text>
            <Text style={styles.xDot}>·</Text>
            <Text style={styles.xHandle} numberOfLines={1}>@{username}</Text>
            {isIdVerified && (
              <CheckCircle2 size={13} color="#0284c7" />
            )}
            <Pressable onPress={() => data.profiles?.id && router.push({ pathname: '/user', params: { id: data.profiles.id } })}>
              <Text style={styles.xAuthorName} numberOfLines={1}>{name}</Text>
            </Pressable>
          </View>

          {/* District & City location tag */}
          <View style={styles.xLocationRow}>
            <MapPin size={11} color="#0891b2" />
            <Text style={styles.xLocationText}>
              {data.district ? `حي ${data.district}` : 'الحي'}{data.city ? ` · ${data.city}` : ''}
            </Text>
          </View>
        </View>

        {/* Left side: Options menu button */}
        <Pressable onPress={handleMoreOptions} style={styles.xMoreBtn}>
          <MoreHorizontal size={18} color="#94a3b8" />
        </Pressable>
      </View>

      {/* ======================================================== */}
      {/* 2. INQUIRY CONTENT (Clickable to Expand / View Details)  */}
      {/* ======================================================== */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.xContentArea}>
        <Text style={[styles.xTitle, isEmergency && { color: '#991b1b' }]}>
          {data.title}
        </Text>
        
        {(data.body || data.description) && (
          <Text style={styles.xBodyText} numberOfLines={expanded ? undefined : 3}>
            {isReq ? data.description : data.body}
          </Text>
        )}

        {/* Dynamic Hashtags Pill Row */}
        <View style={styles.xHashtagRow}>
          {data.district && (
            <View style={styles.xHashPill}>
              <Text style={styles.xHashText}>#{data.district.replace(/\s+/g, '_')}</Text>
            </View>
          )}
          <View style={styles.xHashPill}>
            <Text style={styles.xHashText}>#أهل_الحي</Text>
          </View>
          {isToolSharing && (
            <View style={[styles.xHashPill, { backgroundColor: '#f0fdf4' }]}>
              <Text style={[styles.xHashText, { color: '#16a34a' }]}>#إعارة_مجانية</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* ======================================================== */}
      {/* 3. TWITTER ACTION BAR (Interactive Twitter / X Bar)       */}
      {/* ======================================================== */}
      <View style={styles.xActionBar}>
        {/* 1. Reply Button (Toggles Inline Expansion) */}
        <Pressable 
          style={[styles.xActionBtn, expanded && styles.xActionBtnActive]} 
          onPress={() => setExpanded(!expanded)}
        >
          <MessageCircle size={17} color={expanded ? '#0891b2' : '#64748b'} />
          <Text style={[styles.xActionCounter, expanded && { color: '#0891b2', fontWeight: '800' }]}>
            {answersCount}
          </Text>
        </Pressable>

        {/* 2. Repost / Retweet */}
        <Pressable style={styles.xActionBtn} onPress={handleRepost}>
          <Repeat size={17} color={reposted ? '#16a34a' : '#64748b'} />
          <Text style={[styles.xActionCounter, reposted && { color: '#16a34a', fontWeight: '800' }]}>
            {repostCount > 0 ? repostCount : ''}
          </Text>
        </Pressable>

        {/* 3. Heart / Like */}
        <Pressable style={styles.xActionBtn} onPress={handleLike}>
          <Heart size={17} color={liked ? '#f43f5e' : '#64748b'} fill={liked ? '#f43f5e' : 'none'} />
          <Text style={[styles.xActionCounter, liked && { color: '#f43f5e', fontWeight: '800' }]}>
            {likeCount}
          </Text>
        </Pressable>

        {/* 4. Bookmark */}
        <Pressable style={styles.xActionBtn} onPress={handleBookmark}>
          <Bookmark size={17} color={bookmarked ? '#f59e0b' : '#64748b'} fill={bookmarked ? '#f59e0b' : 'none'} />
        </Pressable>

        {/* 5. Share */}
        <Pressable style={styles.xActionBtn} onPress={handleShare}>
          <Share2 size={17} color="#64748b" />
        </Pressable>

        {/* 6. Views */}
        <View style={styles.xActionBtn}>
          <Eye size={16} color="#94a3b8" />
          <Text style={styles.xActionViews}>{viewsCount}</Text>
        </View>
      </View>

      {/* ======================================================== */}
      {/* 4. PROGRESSIVE EXPANSION (خيط الردود والتفاصيل التدريجي) */}
      {/* ======================================================== */}
      {expanded && (
        <View style={styles.xThreadContainer}>
          {/* Thread Header */}
          <View style={styles.xThreadHeader}>
            <Pressable onPress={() => setExpanded(false)} style={styles.xThreadCloseBtn}>
              <ChevronUp size={14} color="#0891b2" />
              <Text style={styles.xThreadCloseText}>طي التفاصيل</Text>
            </Pressable>
            <View style={styles.xThreadTitleRow}>
              <Text style={styles.xThreadTitle}>خيط الردود والتوصيات ({answersCount})</Text>
              <Sparkles size={14} color="#0891b2" />
            </View>
          </View>

          {/* List of answers */}
          {answers.length > 0 ? (
            <View style={styles.xAnswersList}>
              {answers.map((ans: any, idx: number) => {
                const ansName = ans.profiles?.hide_name ? 'جار مجهول 🕶️' : (ans.profiles?.display_name || ans.profiles?.username || 'ابن الحي');
                const ansAvatar = ans.profiles?.avatar_url;
                const isAccepted = ans.is_accepted || idx === 0;

                return (
                  <View key={ans.id || idx} style={styles.xAnswerItem}>
                    {/* Thread Line Connector */}
                    <View style={styles.xThreadLine} />

                    {/* Answer Author Avatar */}
                    <View style={styles.xAnswerAvatarWrap}>
                      {ansAvatar ? (
                        <Image source={{ uri: ansAvatar }} style={styles.xAnswerAvatar} />
                      ) : (
                        <View style={styles.xAnswerAvatarFallback}>
                          <Text style={styles.xAnswerAvatarLetter}>{ansName[0]}</Text>
                        </View>
                      )}
                    </View>

                    {/* Answer Bubble */}
                    <View style={[styles.xAnswerBubble, isAccepted && styles.xAnswerBubbleAccepted]}>
                      <View style={styles.xAnswerHeaderRow}>
                        <Text style={styles.xAnswerTime}>{formatArabicTimeAgo(ans.created_at)}</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                          <Text style={styles.xAnswerAuthorName}>{ansName}</Text>
                          {ans.profiles?.is_geoverified && (
                            <ShieldCheck size={11} color="#16a34a" />
                          )}
                          {isAccepted && (
                            <View style={styles.xAcceptedBadge}>
                              <Check size={10} color="#fff" />
                              <Text style={styles.xAcceptedBadgeText}>توصية معتمدة</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Text style={styles.xAnswerBodyText}>{ans.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.xNoAnswersBox}>
              <Text style={styles.xNoAnswersText}>
                كن أول من يفيد جارك ويقدم توصية أو حلاً لهذا الاستفسار! 💡
              </Text>
            </View>
          )}

          {/* Inline Quick Reply Input */}
          <View style={styles.xQuickReplyContainer}>
            <View style={styles.xQuickReplyAvatar}>
              {currentUserProfile?.avatar_url ? (
                <Image source={{ uri: currentUserProfile.avatar_url }} style={styles.xMiniAvatar} />
              ) : (
                <View style={styles.xMiniAvatarFallback}>
                  <Text style={styles.xMiniAvatarLetter}>{currentUserProfile?.display_name?.[0] || 'أ'}</Text>
                </View>
              )}
            </View>

            <TextInput 
              style={styles.xQuickReplyInput}
              placeholder="اكتب إجابتك أو إفادتك للجار..."
              placeholderTextColor="#94a3b8"
              value={quickReplyText}
              onChangeText={setQuickReplyText}
              multiline
            />

            <Pressable 
              style={[styles.xQuickReplySendBtn, (!quickReplyText.trim() || replyLoading) && styles.xQuickReplySendBtnDisabled]}
              onPress={handleSendReply}
              disabled={!quickReplyText.trim() || replyLoading}
            >
              <Send size={15} color="#fff" />
              <Text style={styles.xQuickReplySendText}>رد</Text>
            </Pressable>
          </View>

          {/* Full Page Navigation Link */}
          <Pressable style={styles.xOpenFullThreadBtn} onPress={navigateToDetails}>
            <Text style={styles.xOpenFullThreadText}>
              {isReq ? 'فتح صفحة طلب الفزعة بالكامل ←' : 'فتح صفحة الاستفسار الكاملة والمحادثات المباشرة ←'}
            </Text>
            <ExternalLink size={14} color="#0891b2" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ========================================================
// STYLESHEET
// ========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  toastBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 42,
    alignSelf: 'center',
    zIndex: 999,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toastBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 38,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#0284c7',
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
  heroBrandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  brandKsaFlag: {
    fontSize: 20,
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
  clearSearchText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  storiesContainer: {
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'center',
  },
  storyBox: {
    alignItems: 'center',
    width: 64,
  },
  storyAddRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyAddBtn: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
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
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  hubCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e0f2fe',
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  hubHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hubTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  hubTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0e7490',
  },
  hubSolvedBadge: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cffafe',
  },
  hubSolvedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891b2',
  },
  hubExpandedBody: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f9ff',
    paddingTop: 10,
  },
  hubSummaryText: {
    fontSize: 12,
    color: '#155e75',
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 8,
  },
  hubTopicsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  hubTopicPill: {
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  hubTopicText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
  },
  proximityBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  proxPill: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  proxPillActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  proxPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891b2',
  },
  proxPillTextActive: {
    color: '#fff',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  fTabActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  fTabActiveRed: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  fTabActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  fTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  fTabTextActive: {
    color: '#fff',
  },

  // ========================================================
  // TWITTER / X CARD STYLES
  // ========================================================
  xCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  xCardEmergency: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafa',
  },
  xCardToolSharing: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  xHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  xAvatarWrap: {
    position: 'relative',
    marginLeft: 10,
  },
  xAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  xAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  xGeoBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: '#16a34a',
    width: 15,
    height: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  xAuthorMeta: {
    flex: 1,
    alignItems: 'flex-end',
  },
  xAuthorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  xAuthorName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  xHandle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    maxWidth: 90,
  },
  xDot: {
    fontSize: 12,
    color: '#94a3b8',
  },
  xTimeAgo: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  xLocationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  xLocationText: {
    fontSize: 11,
    color: '#0891b2',
    fontWeight: '700',
  },
  xMoreBtn: {
    padding: 4,
  },
  xCategoryBadge: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  xCategoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0891b2',
  },
  xEmergencyBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  xEmergencyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#dc2626',
  },
  xToolBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  xToolBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
  },
  xReqBadge: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  xReqBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#d97706',
  },
  xContentArea: {
    marginVertical: 4,
  },
  xTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 23,
    marginBottom: 4,
  },
  xBodyText: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 21,
    marginBottom: 6,
  },
  xHashtagRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  xHashPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  xHashText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  xActionBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  xActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  xActionBtnActive: {
    backgroundColor: '#ecfeff',
  },
  xActionCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  xActionViews: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // ========================================================
  // PROGRESSIVE THREAD EXPANSION STYLES
  // ========================================================
  xThreadContainer: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  xThreadHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 10,
  },
  xThreadTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  xThreadTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0891b2',
  },
  xThreadCloseBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  xThreadCloseText: {
    fontSize: 11,
    color: '#0891b2',
    fontWeight: '700',
  },
  xAnswersList: {
    gap: 10,
    marginBottom: 10,
  },
  xAnswerItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    position: 'relative',
  },
  xThreadLine: {
    position: 'absolute',
    top: 32,
    right: 14,
    bottom: -10,
    width: 2,
    backgroundColor: '#cbd5e1',
    zIndex: 1,
  },
  xAnswerAvatarWrap: {
    marginLeft: 8,
    zIndex: 2,
  },
  xAnswerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  xAnswerAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  xAnswerAvatarLetter: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  xAnswerBubble: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  xAnswerBubbleAccepted: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  xAnswerHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xAnswerAuthorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  xAnswerTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  xAcceptedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  xAcceptedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  xAnswerBodyText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    textAlign: 'right',
  },
  xNoAnswersBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  xNoAnswersText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  xQuickReplyContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 8,
    marginTop: 4,
  },
  xQuickReplyAvatar: {
    width: 26,
    height: 26,
  },
  xMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  xMiniAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  xMiniAvatarLetter: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  xQuickReplyInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    textAlign: 'right',
    maxHeight: 60,
    paddingVertical: 4,
  },
  xQuickReplySendBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#0891b2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  xQuickReplySendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  xQuickReplySendText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  xOpenFullThreadBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: '#ecfeff',
    borderRadius: 10,
    gap: 6,
  },
  xOpenFullThreadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891b2',
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
    backgroundColor: '#ecfeff',
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
    backgroundColor: '#0891b2',
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
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
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
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  spacesSection: {
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 10,
  },
  spacesHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginHorizontal: 16,
    marginBottom: 12,
    textAlign: 'right',
  },
  spacesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  spaceCard: {
    width: 240,
    padding: 16,
    borderRadius: 20,
    justifyContent: 'space-between',
    minHeight: 130,
  },
  spaceCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  spaceLiveBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  spaceLiveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  spaceHostText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  spaceTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: 14,
  },
  spaceCardBottom: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spaceAvatarsRow: {
    flexDirection: 'row-reverse',
  },
  spaceAvatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#cbd5e1',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  spaceListenersText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
  },
  newsletterCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  newsletterHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  newsletterTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  newsletterBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  newsletterBadgeText: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 12,
  },
  newsletterDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: 14,
  },
  newsletterTrends: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  trendItem: {
    fontSize: 13,
    color: '#334155',
    textAlign: 'right',
    fontWeight: '600',
  },
});