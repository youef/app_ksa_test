import { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import {
  ChevronRight,
  Sparkles,
  MapPin,
  Tag,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  Flame,
  Wrench,
  Gift,
  MessageSquare,
  Bot,
  ShieldAlert,
} from 'lucide-react-native';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import {
  analyzeQuestionWithAI,
  enhanceQuestionContentAI,
  generateInstantResidentAnswerAI,
  detectEmergencyAndSafetyAI,
  AISmartAnalysis,
  InstantResidentAnswer,
  SafetyAndSpamCheck,
} from '@/lib/aiAssistant';

export default function AskScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Post category type
  const [postType, setPostType] = useState<'inquiry' | 'tool_sharing' | 'donate' | 'emergency'>('inquiry');

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AISmartAnalysis | null>(null);
  const [instantAnswer, setInstantAnswer] = useState<InstantResidentAnswer | null>(null);
  const [safetyCheck, setSafetyCheck] = useState<SafetyAndSpamCheck | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([]);

  // 1. Auto-link user profile location upon mounting
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('city, district')
        .eq('id', u.user.id)
        .maybeSingle();

      if (prof) {
        if (prof.city) setCity(prof.city);
        if (prof.district) setDistrict(prof.district);
      }
    })();
  }, []);

  // 2. Real-time AI Analysis & Safety Check on title/body change
  useEffect(() => {
    const fullText = `${title} ${body}`.trim();
    if (title.trim().length >= 3) {
      const analysis = analyzeQuestionWithAI(title, body);
      setAiAnalysis(analysis);

      // Emergency & Anti-Spam Safety Check
      const safety = detectEmergencyAndSafetyAI(fullText);
      setSafetyCheck(safety);

      if (safety.isEmergency && postType !== 'emergency') {
        setPostType('emergency');
      }

      // Generate Instant Resident AI Answer if sufficient context
      if (title.trim().length >= 5) {
        const answer = generateInstantResidentAnswerAI(title, city, district);
        setInstantAnswer(answer);
      } else {
        setInstantAnswer(null);
      }

      // Search for similar questions in the same city
      findSimilarQuestions(title.trim());
    } else {
      setAiAnalysis(null);
      setInstantAnswer(null);
      setSafetyCheck(null);
      setSimilarQuestions([]);
    }
  }, [title, body, city, district]);

  async function findSimilarQuestions(queryText: string) {
    try {
      let q = supabase
        .from('questions')
        .select('id, title, city, district')
        .ilike('title', `%${queryText.split(' ')[0]}%`)
        .limit(3);

      if (city && city !== 'كل المدن') {
        q = q.eq('city', city);
      }

      const { data } = await q;
      setSimilarQuestions(data ?? []);
    } catch (e) {
      // Ignore background search error
    }
  }

  // 3. AI Question Enhancement
  function handleAIEnhance() {
    if (!title.trim()) {
      return Alert.alert('تنبيه', 'اكتب سؤالك أولاً وسيقوم الذكاء الاصطناعي بصياغته وتحسينه لك.');
    }

    setEnhancing(true);
    setTimeout(() => {
      const result = enhanceQuestionContentAI(title, body, city, district);
      setTitle(result.enhancedTitle);
      if (result.enhancedBody) {
        setBody(result.enhancedBody);
      }
      setEnhancing(false);
    }, 400);
  }

  // 4. Save & Publish
  async function save() {
    if (!title.trim()) {
      return Alert.alert('مطلوب', 'يرجى كتابة عنوان السؤال.');
    }
    if (!city) {
      return Alert.alert('تحديد الموقع', 'يرجى اختيار مدينتك وحيك لضمان وصول سؤالك لجيرانك بدقة.');
    }

    // Safety and Anti-spam prevention
    if (safetyCheck?.isSpam) {
      return Alert.alert('تنبيه أمان المجتمع', safetyCheck.spamReason || 'المحتوى ترويجي أو عشوائي وغير مصرح به.');
    }

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('يجب تسجيل الدخول أولاً.');

      const isEmergency = safetyCheck?.isEmergency || postType === 'emergency';
      const isToolSharing = postType === 'tool_sharing';

      const payload: any = {
        author_id: u.user.id,
        title: title.trim(),
        body: body.trim() || 'بدون تفاصيل إضافية',
        city: city.trim(),
        district: district.trim() || null,
      };

      // Try inserting with extended columns, fallback gracefully if columns not yet run
      let insertedQuestionId: string | null = null;
      try {
        const { data, error } = await supabase
          .from('questions')
          .insert({
            ...payload,
            is_emergency: isEmergency,
            urgency_level: isEmergency ? 'emergency' : 'normal',
            is_tool_sharing: isToolSharing,
            item_type: postType,
          })
          .select('id')
          .single();

        if (error) throw error;
        insertedQuestionId = data.id;
      } catch (errCol) {
        // Fallback to basic columns if advanced migration not yet executed
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('questions')
          .insert(payload)
          .select('id')
          .single();

        if (fallbackError) throw fallbackError;
        insertedQuestionId = fallbackData.id;
      }

      if (insertedQuestionId) {
        router.replace({ pathname: '/question', params: { id: insertedQuestionId } });
      }
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'تعذر نشر السؤال، حاول ثانية.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <LinearGradient colors={['#065f46', '#059669', '#10b981']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={26} color="#fff" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>اسأل أهل حيك 🇸🇦</Text>
          <Text style={styles.headerSub}>مربوط بموقعك مع خوارزميات ذكاء اصطناعي فورية</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Post Type Selector Tabs */}
        <View style={styles.postTypeContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postTypeTabs}>
            <Pressable
              style={[styles.typeTab, postType === 'inquiry' && styles.typeTabActive]}
              onPress={() => setPostType('inquiry')}
            >
              <MessageSquare size={16} color={postType === 'inquiry' ? '#fff' : '#0891b2'} />
              <Text style={[styles.typeTabText, postType === 'inquiry' && styles.typeTabTextActive]}>
                استفسار للحي
              </Text>
            </Pressable>

            <Pressable
              style={[styles.typeTab, postType === 'tool_sharing' && styles.typeTabActiveGreen]}
              onPress={() => setPostType('tool_sharing')}
            >
              <Wrench size={16} color={postType === 'tool_sharing' ? '#fff' : '#16a34a'} />
              <Text style={[styles.typeTabText, postType === 'tool_sharing' && styles.typeTabTextActive]}>
                إعارة أدوات
              </Text>
            </Pressable>

            <Pressable
              style={[styles.typeTab, postType === 'donate' && styles.typeTabActivePurple]}
              onPress={() => setPostType('donate')}
            >
              <Gift size={16} color={postType === 'donate' ? '#fff' : '#9333ea'} />
              <Text style={[styles.typeTabText, postType === 'donate' && styles.typeTabTextActive]}>
                تبادل مجاني
              </Text>
            </Pressable>

            <Pressable
              style={[styles.typeTab, postType === 'emergency' && styles.typeTabActiveRed]}
              onPress={() => setPostType('emergency')}
            >
              <Flame size={16} color={postType === 'emergency' ? '#fff' : '#dc2626'} />
              <Text style={[styles.typeTabText, postType === 'emergency' && styles.typeTabTextActive]}>
                بلاغ طارئ 🚨
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Location Selector Card (Auto-linked to user) */}
        <View style={styles.locationCard}>
          <View style={styles.locationCardHeader}>
            <View style={styles.locationBadge}>
              <Text style={styles.locationBadgeText}>موقع السؤال المربوط</Text>
            </View>
            <Text style={styles.locationLabel}>المنطقة والحي المستهدف</Text>
          </View>

          <Pressable
            style={styles.locationBtn}
            onPress={() => setShowLocationModal(true)}
          >
            <ChevronDown size={18} color="#0891b2" />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.locationValue}>
                {city ? `${city} ${district ? `· ${district}` : ''}` : 'اختر مدينتك وحيك...'}
              </Text>
              <Text style={styles.locationHint}>
                {city ? 'اضغط لتغيير المنطقة أو الحي أو البحث بالرمز الوطني' : 'حدد موقعك ليصل السؤال لجيرانك فقط'}
              </Text>
            </View>
            <View style={styles.mapPinWrap}>
              <MapPin size={20} color="#0891b2" />
            </View>
          </Pressable>
        </View>

        {/* Emergency Alert Banner (Triggered by AI or selector) */}
        {(safetyCheck?.isEmergency || postType === 'emergency') && (
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeader}>
              <Flame size={20} color="#dc2626" />
              <Text style={styles.emergencyTitle}>تنبيه حالة طارئة بأولوية قصوى لأهل الحي</Text>
            </View>
            <Text style={styles.emergencyDesc}>
              سيتم تثبيت هذا البلاغ في أعلى خلاصة الحي وإرسال إشعار فوري لجميع الجيران المتواجدين حالياً للمساعدة السريعة.
            </Text>
          </View>
        )}

        {/* Anti-Spam Warning if detected */}
        {safetyCheck?.isSpam && (
          <View style={styles.spamWarningCard}>
            <ShieldAlert size={20} color="#ea580c" />
            <View style={{ flex: 1 }}>
              <Text style={styles.spamWarningTitle}>تنبيه أمان المجتمع</Text>
              <Text style={styles.spamWarningDesc}>{safetyCheck.spamReason}</Text>
            </View>
          </View>
        )}

        {/* AI Enhancement Action Banner */}
        <Pressable
          style={styles.aiBanner}
          onPress={handleAIEnhance}
          disabled={enhancing}
        >
          {enhancing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Sparkles size={18} color="#fff" />
          )}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.aiBannerTitle}>تحسين وتنسيق بالذكاء الاصطناعي ✨</Text>
            <Text style={styles.aiBannerSub}>
              صياغة واضحة ومهذبة لجيران الحي تلقائياً بنقرة زر
            </Text>
          </View>
        </Pressable>

        {/* Input: Question Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {postType === 'tool_sharing'
              ? 'اسم الأداة أو المعدة المعارة *'
              : postType === 'donate'
              ? 'الشيء المعروض للتبادل المجاني *'
              : postType === 'emergency'
              ? 'عنوان البلاغ الطارئ *'
              : 'عنوان السؤال *'}
          </Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder={
              postType === 'tool_sharing'
                ? 'مثال: دريل تخريم خرسانة للإعارة المجانية بالحي'
                : postType === 'emergency'
                ? 'مثال: طفل مفقود بالقرب من حديقة الحي'
                : 'مثال: وين أفضل ورشة صيانة سيارات في الحي؟'
            }
            placeholderTextColor="#94a3b8"
            maxLength={120}
          />
        </View>

        {/* Input: Question Body */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>التفاصيل والشرح (اختياري)</Text>
          <TextInput
            style={[styles.titleInput, styles.bodyInput]}
            multiline
            value={body}
            onChangeText={setBody}
            placeholder="اكتب أي معلومات إضافية تفيد الجيران في مساعدتك..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* INSTANT AI RESIDENT ANSWER (Synthesized Neighborhood Knowledge) */}
        {instantAnswer && (
          <View style={styles.instantAnswerCard}>
            <View style={styles.instantAnswerHeader}>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>دقة {instantAnswer.confidenceScore}%</Text>
              </View>
              <View style={styles.instantAnswerTitleRow}>
                <Text style={styles.instantAnswerTitle}>إجابة فورية من أرشيف تجارب الجيران</Text>
                <Bot size={20} color="#0891b2" />
              </View>
            </View>
            <Text style={styles.instantAnswerSub}>
              ملخص ذكي ريثما يرد الجيران الفعليون في الحي:
            </Text>

            <Text style={styles.instantSummaryText}>{instantAnswer.summary}</Text>

            <View style={styles.keyPointsBox}>
              {instantAnswer.keyPoints.map((pt, idx) => (
                <View key={idx} style={styles.pointRow}>
                  <Text style={styles.pointText}>{pt}</Text>
                  <Text style={styles.bulletDot}>•</Text>
                </View>
              ))}
            </View>

            <View style={styles.actionBox}>
              <Lightbulb size={16} color="#d97706" />
              <Text style={styles.actionText}>{instantAnswer.recommendedAction}</Text>
            </View>
          </View>
        )}

        {/* AI Smart Insights (Real-time category & tags) */}
        {aiAnalysis && (
          <View style={styles.aiInsightCard}>
            <View style={styles.aiInsightHeader}>
              <View style={styles.aiBadge}>
                <Sparkles size={14} color="#0891b2" />
                <Text style={styles.aiBadgeText}>تصنيف الذكاء الاصطناعي</Text>
              </View>
              <Text style={styles.aiInsightCategory}>{aiAnalysis.category}</Text>
            </View>

            {/* Smart Tags */}
            <View style={styles.tagsRow}>
              {aiAnalysis.tags.map((t, idx) => (
                <View key={idx} style={styles.tagPill}>
                  <Tag size={12} color="#0891b2" />
                  <Text style={styles.tagPillText}>#{t}</Text>
                </View>
              ))}
            </View>

            {/* Instant Tip */}
            <View style={styles.tipBox}>
              <Text style={styles.tipText}>{aiAnalysis.instantTip}</Text>
            </View>
          </View>
        )}

        {/* AI Similar Questions Found */}
        {similarQuestions.length > 0 && (
          <View style={styles.similarCard}>
            <View style={styles.similarHeader}>
              <HelpCircle size={18} color="#d97706" />
              <Text style={styles.similarTitle}>أسئلة مشابهة سألها جيرانك سابقاً</Text>
            </View>
            {similarQuestions.map(sq => (
              <Pressable
                key={sq.id}
                style={styles.similarItem}
                onPress={() => router.push({ pathname: '/question', params: { id: sq.id } })}
              >
                <ExternalLink size={16} color="#0891b2" />
                <Text style={styles.similarItemText} numberOfLines={1}>
                  {sq.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Submit Button */}
        <Pressable
          style={[styles.submitBtn, busy && { opacity: 0.7 }]}
          onPress={save}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <CheckCircle2 size={22} color="#fff" />
          )}
          <Text style={styles.submitBtnText}>
            {busy
              ? 'جاري النشر...'
              : postType === 'emergency'
              ? '🚨 نشر البلاغ الطارئ في الحي فوراً'
              : postType === 'tool_sharing'
              ? '🛠️ نشر عرض إعارة الأداة في الحي'
              : 'نشر السؤال في الحي الآن'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Structured Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={city || 'كل المدن'}
        selectedDistrict={district || 'كل الأحياء'}
        onSelect={(r, c, d) => {
          setRegion(r);
          setCity(c === 'كل المدن' ? '' : c);
          setDistrict(d === 'كل الأحياء' ? '' : d);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 38,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  postTypeContainer: {
    marginBottom: 16,
  },
  postTypeTabs: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  typeTab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  typeTabActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  typeTabActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  typeTabActivePurple: {
    backgroundColor: '#9333ea',
    borderColor: '#9333ea',
  },
  typeTabActiveRed: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  typeTabTextActive: {
    color: '#fff',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  locationCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  locationBadge: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891b2',
  },
  locationBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  locationValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  locationHint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  mapPinWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ecfeff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  emergencyHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#b91c1c',
    textAlign: 'right',
  },
  emergencyDesc: {
    fontSize: 12,
    color: '#991b1b',
    textAlign: 'right',
    lineHeight: 18,
  },
  spamWarningCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  spamWarningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c2410c',
    textAlign: 'right',
  },
  spamWarningDesc: {
    fontSize: 12,
    color: '#9a3412',
    textAlign: 'right',
    marginTop: 2,
  },
  aiBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#0891b2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  aiBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'right',
  },
  aiBannerSub: {
    fontSize: 11,
    color: '#e0f2fe',
    textAlign: 'right',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    textAlign: 'right',
  },
  bodyInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  instantAnswerCard: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  instantAnswerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  instantAnswerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  instantAnswerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f766e',
  },
  confidenceBadge: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5eead4',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
  },
  instantAnswerSub: {
    fontSize: 12,
    color: '#115e59',
    textAlign: 'right',
    marginBottom: 10,
  },
  instantSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134e4a',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 10,
  },
  keyPointsBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  pointRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {
    fontSize: 16,
    color: '#0d9488',
    lineHeight: 18,
  },
  pointText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 18,
  },
  actionBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'right',
  },
  aiInsightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aiInsightHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891b2',
  },
  aiInsightCategory: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tagPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  tipBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderRightWidth: 3,
    borderRightColor: '#059669',
  },
  tipText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 18,
  },
  similarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  similarHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  similarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
  },
  similarItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  similarItemText: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
    marginLeft: 8,
  },
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    height: 54,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
