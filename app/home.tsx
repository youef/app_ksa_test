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
  Compass,
  Radio,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
} from 'lucide-react-native';
import { C } from '@/lib/ui';
import BottomNav from '@/components/BottomNav';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { generateNeighborhoodPulseAI } from '@/lib/aiAssistant';

const { width } = Dimensions.get('window');

export default function Home() {
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

  // Proximity Radius filter (0-2km in district, 2-5km nearby, city-wide)
  const [proximityRadius, setProximityRadius] = useState<'district' | 'nearby' | 'city'>('district');
  const [pulseExpanded, setPulseExpanded] = useState(true);

  // Unread badge count
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Animation for FAB
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
      const { data: qProfiles } = await supabase.from('profiles').select('*').in('id', authorIds);
      const profileMap = (qProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      setQuestions(uniqueQData.map((q: any) => ({ ...q, profiles: profileMap[q.author_id] || null })));
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

  // Filter questions and requests by selected Saudi region / city / district & Proximity Radius
  const filteredQuestions = questions.filter(q => {
    if (searchQuery.trim()) {
      const match = (q.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (q.body || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!match) return false;
    }
    if (selectedCity === 'كل المدن') return true;
    if (proximityRadius === 'city') {
      if (q.city && !q.city.includes(selectedCity) && !selectedCity.includes(q.city)) return false;
      return true;
    }
    if (proximityRadius === 'district' && selectedDistrict !== 'كل الأحياء') {
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
    if (proximityRadius === 'city') {
      if (r.city && !r.city.includes(selectedCity) && !selectedCity.includes(r.city)) return false;
      return true;
    }
    if (proximityRadius === 'district' && selectedDistrict !== 'كل الأحياء') {
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
                placeholder="ابحث عن سؤال، خدمة، أو جار في حيك..." 
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
                <Pressable style={styles.micBtn} onPress={() => router.push('/search')}>
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
                  <View key={i} style={styles.hubTopicPill}>
                    <Text style={styles.hubTopicText}>🔥 {topic}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Proximity Radius Filter Tabs Inside Hub */}
          <View style={styles.proximityBar}>
            <Pressable
              style={[styles.proxPill, proximityRadius === 'district' && styles.proxPillActive]}
              onPress={() => setProximityRadius('district')}
            >
              <MapPin size={13} color={proximityRadius === 'district' ? '#fff' : '#0891b2'} />
              <Text style={[styles.proxPillText, proximityRadius === 'district' && styles.proxPillTextActive]}>
                في حيي (0 - 2 كم)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.proxPill, proximityRadius === 'nearby' && styles.proxPillActive]}
              onPress={() => setProximityRadius('nearby')}
            >
              <Compass size={13} color={proximityRadius === 'nearby' ? '#fff' : '#0891b2'} />
              <Text style={[styles.proxPillText, proximityRadius === 'nearby' && styles.proxPillTextActive]}>
                الأحياء المجاورة (2 - 5 كم)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.proxPill, proximityRadius === 'city' && styles.proxPillActive]}
              onPress={() => setProximityRadius('city')}
            >
              <Radio size={13} color={proximityRadius === 'city' ? '#fff' : '#0891b2'} />
              <Text style={[styles.proxPillText, proximityRadius === 'city' && styles.proxPillTextActive]}>
                كامل المدينة
              </Text>
            </Pressable>
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
            icon={<MessageCircle size={24} color="#0284c7" />} 
            bg="#f0f9ff" 
            label="استفسارات" 
            onPress={() => setActiveTab('questions')} 
          />
          <ServicePill 
            icon={<Wrench size={24} color="#16a34a" />} 
            bg="#f0fdf4" 
            label="إعارة أدوات" 
            onPress={() => setActiveTab('tools')} 
          />
          <ServicePill 
            icon={<Truck size={24} color="#d97706" />} 
            bg="#fffbeb" 
            label="فزعة وخدمات" 
            onPress={() => setActiveTab('requests')} 
          />
          <ServicePill 
            icon={<MapPin size={24} color="#7c3aed" />} 
            bg="#faf5ff" 
            label="دليل المحلات" 
            onPress={() => router.push('/directory')} 
          />
          <ServicePill 
            icon={<Map size={24} color="#0891b2" />} 
            bg="#ecfeff" 
            label="رادار الخريطة" 
            onPress={() => router.push('/map')} 
          />
        </View>

        {/* ======================================================== */}
        {/* 6. COMMUNITY FEED SECTION & TABS                        */}
        {/* ======================================================== */}
        <View style={styles.feedSection}>
          {/* Floating Segmented Tabs */}
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

          {/* Render Feed List */}
          {activeTab === 'all' && (
            [
              ...filteredQuestions.map(q => ({ type: 'question' as const, data: q })),
              ...filteredRequests.map(r => ({ type: 'request' as const, data: r }))
            ]
              .sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
              .map(item => (
                <ModernPost key={`${item.type}-${item.data.id}`} type={item.type} data={item.data} />
              ))
          )}

          {activeTab === 'emergency' && emergencyQuestions.map(q => (
            <ModernPost key={`em-${q.id}`} type="question" data={q} />
          ))}

          {activeTab === 'tools' && toolQuestions.map(q => (
            <ModernPost key={`tool-${q.id}`} type="question" data={q} />
          ))}

          {activeTab === 'questions' && filteredQuestions.map(q => (
            <ModernPost key={`q-${q.id}`} type="question" data={q} />
          ))}

          {activeTab === 'requests' && filteredRequests.map(r => (
            <ModernPost key={`r-${r.id}`} type="request" data={r} />
          ))}

          {/* Empty States */}
          {activeTab === 'all' && filteredQuestions.length === 0 && filteredRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Sparkles size={36} color="#0891b2" />
              </View>
              <Text style={styles.emptyTitle}>
                {selectedCity === 'كل المدن' ? 'لا توجد منشورات حالياً' : `لا توجد منشورات في ${selectedCity} حالياً`}
              </Text>
              <Text style={styles.emptySub}>
                كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك.
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
      <Text style={styles.serviceLabel}>{label}</Text>
    </Pressable>
  );
}

function ModernPost({ type, data }: { type: 'question' | 'request', data: any }) {
  const isReq = type === 'request';
  const name = data.profiles?.hide_name ? 'مستخدم مجهول' : (data.profiles?.display_name || data.profiles?.username || 'مستخدم');
  const avatar = data.profiles?.avatar_url;
  const isVerifiedNeighbor = data.profiles?.is_geoverified;
  const isEmergency = data.is_emergency || data.urgency_level === 'emergency' || (data.title && (data.title.includes('مفقود') || data.title.includes('طارئ')));
  const isToolSharing = data.is_tool_sharing || data.item_type === 'tool_sharing' || (data.title && (data.title.includes('إعارة') || data.title.includes('دريل')));

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 8) + 2);

  function handleLike() {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  }

  function handleShare() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin + `/question?id=${data.id}`);
      Alert.alert('تم النسخ', 'تم نسخ رابط المنشور للمشاركة مع جيرانك!');
    } else {
      Alert.alert('مشاركة', 'شارك هذا المنشور عبر مجموعات الحي وتطبيقات التواصل.');
    }
  }

  return (
    <Pressable 
      style={[
        styles.postCard,
        isEmergency && styles.postCardEmergency,
        isToolSharing && styles.postCardToolSharing,
      ]} 
      onPress={() => router.push(isReq ? { pathname: '/request', params: { id: data.id } } : { pathname: '/question', params: { id: data.id } })}
    >
      {/* Top Header: Author, Verification & Category Tag */}
      <View style={styles.postHeader}>
        <View style={styles.postAuthorInfo}>
          {avatar ? (
            <Image source={{uri: avatar}} style={styles.postAvatar} />
          ) : (
            <View style={styles.postAvatarFallback}>
              <User size={18} color="#fff" />
            </View>
          )}
          <View style={styles.postAuthorText}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <Text style={styles.postAuthorName}>{name}</Text>
              {isVerifiedNeighbor && (
                <View style={styles.verifiedNeighborBadge}>
                  <Text style={styles.verifiedNeighborText}>ساكن موثّق ✓</Text>
                </View>
              )}
            </View>
            <Text style={styles.postTime}>
              {data.city || 'الرياض'}{data.district ? ` · ${data.district}` : ''} · {new Date(data.created_at).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})}
            </Text>
          </View>
        </View>

        {/* Category Pill Tag */}
        {isEmergency ? (
          <View style={styles.emergencyTagBadge}>
            <Flame size={13} color="#dc2626" />
            <Text style={styles.emergencyTagText}>طارئ</Text>
          </View>
        ) : isToolSharing ? (
          <View style={styles.toolTagBadge}>
            <Wrench size={13} color="#16a34a" />
            <Text style={styles.toolTagText}>إعارة أداة</Text>
          </View>
        ) : (
          <View style={[styles.categoryTagBadge, isReq && styles.categoryTagBadgeReq]}>
            <Text style={[styles.categoryTagText, isReq && styles.categoryTagTextReq]}>
              {isReq ? 'طلب مساعدة' : 'استفسار'}
            </Text>
          </View>
        )}
      </View>

      {/* Post Content */}
      <View style={styles.postBodyContainer}>
        <Text style={[styles.postTitle, isEmergency && { color: '#b91c1c' }]}>{data.title}</Text>
        <Text style={styles.postDesc} numberOfLines={3}>{isReq ? data.description : data.body}</Text>
      </View>

      {/* Post Footer Actions */}
      <View style={styles.postFooter}>
        <View style={styles.postStats}>
          <Pressable style={styles.statActionItem} onPress={handleLike}>
            <Heart size={16} color={liked ? '#ef4444' : '#64748b'} fill={liked ? '#ef4444' : 'none'} />
            <Text style={[styles.statText, liked && { color: '#ef4444' }]}>{likeCount}</Text>
          </Pressable>

          <View style={styles.statActionItem}>
            <MessageCircle size={16} color="#64748b" />
            <Text style={styles.statText}>{Math.floor(Math.random() * 12) + 1}</Text>
          </View>

          <Pressable style={styles.statActionItem} onPress={handleShare}>
            <Share2 size={16} color="#64748b" />
          </Pressable>
        </View>

        <View style={styles.viewDetailsBtn}>
          <Text style={styles.viewDetailsText}>عرض والرد ←</Text>
        </View>
      </View>
    </Pressable>
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
    paddingVertical: 3,
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
    marginBottom: 6,
  },
  servicePill: {
    alignItems: 'center',
    width: (width - 64) / 5,
  },
  serviceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceLabel: {
    fontSize: 11,
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
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  postCardEmergency: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafa',
  },
  postCardToolSharing: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  postHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postAuthorInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAuthorText: {
    alignItems: 'flex-end',
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedNeighborBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  verifiedNeighborText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  postTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  emergencyTagBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  emergencyTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  toolTagBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  toolTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  categoryTagBadge: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryTagBadgeReq: {
    backgroundColor: '#fffbeb',
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0891b2',
  },
  categoryTagTextReq: {
    color: '#d97706',
  },
  postBodyContainer: {
    marginBottom: 14,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    marginBottom: 6,
    lineHeight: 24,
  },
  postDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 22,
  },
  postFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 12,
  },
  postStats: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  statActionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  viewDetailsBtn: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891b2',
  },
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
});