import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MapPin, Sparkles } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/shared/AppHeader';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import LocationScopeBar from '@/components/LocationScopeBar';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import { getActiveLocation, subscribeLocation, isLocationMatching, savePermanentMyLocation, type HaynaLocation } from '@/lib/locationSync';
import { getBrandingLogo, getCachedBrandingLogo, subscribeBrandingLogo } from '@/lib/branding';
import { useBottomNavInset } from '@/lib/bottomNav';

export default function Questions() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [activeLoc, setActiveLoc] = useState<HaynaLocation>({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  const loadQuestions = useCallback(async (location: HaynaLocation = activeLoc) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      setCurrentUserId(user?.id ?? null);

      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, is_geoverified, is_verified, role, district, city')
          .eq('id', user.id)
          .maybeSingle();
        setProfile(userProfile ?? null);
      } else {
        setProfile(null);
      }

      let questions: any[] = [];
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);

      if (!error && data) {
        questions = data;
      } else {
        const fallback = await supabase.rpc('hayna_guest_questions', {
          p_city: location.city,
          p_district: location.district,
          p_limit: 60,
        });
        if (fallback.error) throw fallback.error;
        questions = fallback.data ?? [];
      }

      if (questions.length) {
        const authorIds = Array.from(new Set(questions.map(q => q.author_id).filter(Boolean)));
        const questionIds = questions.map(q => q.id);
        const [profilesResult, answersResult] = await Promise.all([
          authorIds.length
            ? supabase.from('profiles')
                .select('id, display_name, username, avatar_url, is_geoverified, is_verified, hide_name')
                .in('id', authorIds)
            : Promise.resolve({ data: [] } as any),
          supabase.from('answers')
            .select('id, question_id, author_id, body, created_at')
            .in('question_id', questionIds)
            .order('created_at', { ascending: true }),
        ]);

        const profileMap = (profilesResult.data ?? []).reduce((map: any, row: any) => {
          map[row.id] = row;
          return map;
        }, {});
        const answersByQuestion = (answersResult.data ?? []).reduce((map: any, answer: any) => {
          (map[answer.question_id] ||= []).push(answer);
          return map;
        }, {});

        questions = questions.map(question => {
          const answers = answersByQuestion[question.id] ?? [];
          return {
            ...question,
            profiles: profileMap[question.author_id] ?? null,
            answers,
            answers_count: answers.length,
          };
        });
      }

      questions = questions
        .filter(question => !isEmergencyQuestion(question))
        .filter(question => isLocationMatching(question, location.city, location.district))
        .sort((a, b) => {
          const pinned = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
          if (pinned) return pinned;
          const featured = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
          if (featured) return featured;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
      setItems(questions);
      setVisibleCount(10);
    } catch (error: any) {
      console.warn('Load questions error', error);
      setLoadError('تعذر تحميل الاستفسارات حالياً. حاول التحديث مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLoc]);

  useEffect(() => {
    let active = true;
    void getBrandingLogo().then(uri => { if (active) setLogoUri(uri); }).catch(() => undefined);
    const unsubscribeBranding = subscribeBrandingLogo(uri => { if (active) setLogoUri(uri); });
    void getActiveLocation().then(location => {
      if (!active) return;
      setActiveLoc(location);
      void loadQuestions(location);
    });
    const unsubscribeLocation = subscribeLocation(location => {
      setActiveLoc(location);
      void loadQuestions(location);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setCurrentUserId(session?.user?.id ?? null);
      void loadQuestions();
    });
    return () => {
      active = false;
      unsubscribeBranding();
      unsubscribeLocation();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQuestions(activeLoc);
  }, [activeLoc, loadQuestions]);

  const onSelectLocation = useCallback(async (region: string, city: string, district: string) => {
    const location = { region, city, district };
    await savePermanentMyLocation(location, true);
    setActiveLoc(location);
    setShowLocationModal(false);
    void loadQuestions(location);
  }, [loadQuestions]);

  const onQuickReply = useCallback(async (questionId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول لتتمكن من الرد على استفسارات الجيران.');
      return;
    }
    const { error } = await supabase.from('answers').insert({
      question_id: questionId,
      author_id: user.id,
      body,
    });
    if (error) {
      Alert.alert('تعذر إرسال الرد', error.message || 'حاول مرة أخرى.');
      return;
    }
    await loadQuestions(activeLoc);
    Alert.alert('تم بنجاح', 'تم نشر ردك في النقاش.');
  }, [activeLoc, loadQuestions]);

  const showToast = useCallback((message: string) => {
    Alert.alert('حيّنا', message);
  }, []);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="استفسارات الجيران"
        fallbackRoute="/home"
        rightAction={
          <Pressable
            onPress={() => setShowLocationModal(true)}
            style={styles.locationButton}
            accessibilityRole="button"
            accessibilityLabel="تغيير المدينة والحي"
          >
            <MapPin size={17} color="#176b52" />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.feedContent, { paddingBottom: bottomNavInset + 24 }]}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 180;
          if (nearBottom && visibleCount < items.length) {
            setVisibleCount(current => Math.min(current + 10, items.length));
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={['#059669']}
            progressBackgroundColor="#ecfdf5"
          />
        }
      >
        <LocationScopeBar location={activeLoc} />
        {loading && items.length === 0 ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color="#16845f" />
            <Text style={styles.stateText}>جاري تحميل استفسارات الجيران...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{loadError}</Text>
            <Text onPress={() => void loadQuestions(activeLoc)} style={styles.retryText}>إعادة المحاولة</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.stateBox}>
            <View style={styles.emptyIcon}>
              <Sparkles size={28} color="#16845f" />
            </View>
            <Text style={styles.stateTitle}>كن أول من يبدأ النقاش</Text>
            <Text style={styles.stateText}>لا توجد استفسارات ظاهرة حالياً. شارك سؤالك ليستفيد جيرانك من خبرتك وتستفيد من تجاربهم.</Text>
            <Text onPress={() => router.push('/ask')} style={styles.askLink}>+ اطرح استفسارك</Text>
          </View>
        ) : (
          <View style={styles.posts}>
            {items.slice(0, visibleCount).map(question => (
              <TwitterInquiryCard
                key={String(question.id)}
                type="question"
                data={question}
                currentUserProfile={profile}
                currentUserId={currentUserId}
                isGuest={!currentUserId}
                onQuickReply={onQuickReply}
                onToast={showToast}
                onDeleted={() => { void loadQuestions(activeLoc); }}
              />
            ))}
            {visibleCount < items.length && (
              <View style={styles.moreLoading}>
                <ActivityIndicator size="small" color="#16845f" />
                <Text style={styles.moreLoadingText}>اسحب للأسفل لعرض المزيد</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <LocationSelectorModal
        visible={showLocationModal}
        selectedCity={activeLoc.city}
        selectedDistrict={activeLoc.district}
        onSelect={onSelectLocation}
        onClose={() => setShowLocationModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  feedContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f4f7f5',
  },
  locationButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf7ef',
    borderWidth: 1,
    borderColor: '#d8eee0',
  },
  posts: {
    backgroundColor: 'transparent',
  },
  moreLoading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  moreLoadingText: {
    color: '#728178',
    fontSize: 12,
    fontWeight: '600',
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 44,
    marginHorizontal: 2,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0ebe4',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f5ec',
  },
  stateTitle: {
    color: '#17382c',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: '#728178',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryText: {
    color: '#087f5b',
    fontSize: 13,
    fontWeight: '900',
    padding: 8,
  },
  askLink: {
    color: '#087f5b',
    fontSize: 13,
    fontWeight: '900',
    padding: 8,
  },
});
