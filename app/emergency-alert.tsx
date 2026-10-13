import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/shared/AppHeader';
import {
  Flame,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Send,
  Droplets,
  Car,
  UserX,
  HelpCircle,
  ShieldAlert,
  Plus,
  CheckCircle2,
  Clock,
  MessageCircle,
  Share2,
  ShieldCheck,
  Phone,
  Sparkles,
  ListFilter,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { sendPushToMultipleUsers } from '@/lib/pushSender';
import { useBottomNavInset } from '@/lib/bottomNav';
import { relativeTime } from '@/lib/mapPins';

const ALERT_TYPES = [
  { id: 'missing', label: 'طفل أو شخص مفقود', icon: UserX, color: '#dc2626', bg: '#fef2f2' },
  { id: 'water_leak', label: 'تسرب مياه رئيسي', icon: Droplets, color: '#0284c7', bg: '#f0f9ff' },
  { id: 'car_blocked', label: 'سيارة تغلق مخرج أو شارع', icon: Car, color: '#d97706', bg: '#fffbeb' },
  { id: 'fire_hazard', label: 'حريق أو التماس كهربائي', icon: Flame, color: '#e11d48', bg: '#fff1f2' },
  { id: 'general', label: 'أمر طارئ آخر', icon: HelpCircle, color: '#475569', bg: '#f8fafc' },
];

export default function EmergencyAlertScreen() {
  const bottomNavInset = useBottomNavInset();

  // Navigation tab: 'list' (عرض البلاغات) | 'create' (إضافة بلاغ جديد)
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Filter in list: 'all' | 'active' | 'resolved'
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');

  // Data states
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Form states
  const [selectedType, setSelectedType] = useState('missing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        setUserProfile(prof);
        if (prof?.district) {
          setLocationLabel(`حي ${prof.district}، ${prof.city || 'الرياض'}`);
        }
      }
    });
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoadingAlerts(true);
      const { data, error } = await supabase
        .from('urgent_alerts')
        .select(`
          *,
          profiles:creator_id (
            id,
            display_name,
            username,
            avatar_url,
            is_verified,
            phone
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAlerts(data || []);
    } catch (e) {
      console.warn('loadAlerts error:', e);
    } finally {
      setLoadingAlerts(false);
      setRefreshing(false);
    }
  };

  const handleFetchCurrentGps = async () => {
    setFetchingLoc(true);
    try {
      const loc = await getCurrentDeviceLocation();
      if (loc) {
        setCoords({ lat: loc.latitude, lng: loc.longitude });
        const geo = await reverseGeocodeDeviceLocation(loc);
        if (geo?.district) {
          setLocationLabel(`حي ${geo.district}، ${geo.city || ''}`);
        }
      }
    } catch (err) {
      console.warn('GPS location fetch error', err);
    } finally {
      setFetchingLoc(false);
    }
  };

  const handlePublishAlert = async () => {
    if (!title.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة عنوان التنبيه العاجل باختصار.');
    }
    if (!description.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى توضيح التفاصيل لمساعدة الجيران في الاستجابة.');
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return Alert.alert('تسجيل الدخول مطلوب', 'يرجى تسجيل الدخول لبث تنبيه في الحي.', [
        { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
        { text: 'إلغاء', style: 'cancel' },
      ]);
    }

    Alert.alert(
      'تأكيد بث التنبيه الطارئ 🚨',
      'سيتم إرسال هذا التنبيه فوراً لجميع جيران الحي كإشعار عاجل. هل تود المتابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'بث التنبيه الآن',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const district = userProfile?.district || 'الياسمين';
              const city = userProfile?.city || 'الرياض';

              // 1. Insert alert in database table urgent_alerts
              const { data: insertedAlert, error } = await supabase
                .from('urgent_alerts')
                .insert({
                  creator_id: auth.user.id,
                  title: title.trim(),
                  description: description.trim(),
                  alert_type: selectedType,
                  city,
                  district,
                  status: 'active',
                  location_lat: coords?.lat || null,
                  location_lng: coords?.lng || null,
                })
                .select('id')
                .single();

              if (error) throw error;

              // 2. Also insert into questions so it appears prominently on neighborhood feeds & search
              try {
                await supabase.from('questions').insert({
                  author_id: auth.user.id,
                  title: `🚨 تنبيه عاجل: ${title.trim()}`,
                  content: `${description.trim()}\nالموقع: ${locationLabel || `حي ${district}`}`,
                  city,
                  district,
                  category: 'طوارئ',
                  is_emergency: true,
                });
              } catch (qErr) {
                console.warn('Questions emergency insert note:', qErr);
              }

              // 3. Fetch neighbors in the same district to send push notifications
              const { data: neighbors } = await supabase
                .from('profiles')
                .select('id')
                .eq('district', district)
                .neq('id', auth.user.id)
                .limit(100);

              if (neighbors && neighbors.length > 0) {
                const neighborIds = neighbors.map((n) => n.id);
                void sendPushToMultipleUsers(neighborIds, {
                  title: `🚨 تنبيه عاجل في حي ${district}!`,
                  body: title.trim(),
                  data: { url: '/emergency-alert' },
                  sound: 'default',
                });
              }

              // Reset form & reload
              setTitle('');
              setDescription('');
              await loadAlerts();
              setActiveTab('list');

              Alert.alert('تم بث التنبيه بنجاح 🚨', 'تم إشعار سكان الحي فوراً وإضافة البلاغ إلى قائمة البلاغات النشطة.');
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر إرسال التنبيه العاجل');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleResolveAlert = (alertItem: any) => {
    Alert.alert(
      'تأكيد حل البلاغ ✅',
      'هل تم التعامل مع الحالة الطارئة وحلها بنجاح؟ سيتم تحديث حالة البلاغ وإشعار الجيران.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، تم الحل',
          onPress: async () => {
            setResolvingId(alertItem.id);
            try {
              const { error } = await supabase
                .from('urgent_alerts')
                .update({
                  status: 'resolved',
                  resolved_at: new Date().toISOString(),
                })
                .eq('id', alertItem.id);

              if (error) throw error;
              await loadAlerts();
              Alert.alert('الحمد لله على السلامة! ✅', 'تم تحديث حالة البلاغ إلى "تم الحل".');
            } catch (err: any) {
              Alert.alert('خطأ', err.message || 'تعذر تحديث حالة البلاغ');
            } finally {
              setResolvingId(null);
            }
          },
        },
      ]
    );
  };

  const handleShareAlert = async (alertItem: any) => {
    try {
      await Share.share({
        message: `🚨 بلاغ طارئ في حي ${alertItem.district || 'الحي'}:\n${alertItem.title}\n\n${alertItem.description}\nالموقع: ${alertItem.district || ''} - منصة حيّنا`,
      });
    } catch (e) {
      // Ignored
    }
  };

  const activeAlertsCount = alerts.filter((a) => a.status === 'active').length;
  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter === 'active') return a.status === 'active';
    if (statusFilter === 'resolved') return a.status === 'resolved';
    return true;
  });

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="بلاغات وطوارئ الحي"
        subtitle={activeAlertsCount > 0 ? `${activeAlertsCount} بلاغ طارئ نشط حالياً` : 'الحي آمن ومستقر بحمد الله'}
        fallbackRoute="/home"
        rightAction={
          <Pressable
            onPress={() => setActiveTab(activeTab === 'create' ? 'list' : 'create')}
            style={activeTab === 'create' ? styles.headerViewListBtn : styles.headerAddBtn}
            accessibilityRole="button"
            accessibilityLabel={activeTab === 'create' ? 'عرض البلاغات' : 'إضافة بلاغ طارئ'}
          >
            {activeTab === 'create' ? (
              <>
                <ListFilter size={14} color="#059669" />
                <Text style={styles.headerViewListBtnText}>عرض البلاغات</Text>
              </>
            ) : (
              <>
                <Plus size={15} color="#fff" strokeWidth={2.5} />
                <Text style={styles.headerAddBtnText}>إضافة بلاغ</Text>
              </>
            )}
          </Pressable>
        }
      />

      {/* Main Segment Switcher: قسم البلاغات ⇄ إضافة بلاغ جديد */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentBtn, activeTab === 'list' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('list')}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            {activeAlertsCount > 0 && (
              <View style={styles.activeAlertsDot} />
            )}
            <Text style={[styles.segmentBtnText, activeTab === 'list' && styles.segmentBtnTextActive]}>
              🚨 قسم البلاغات ({alerts.length})
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.segmentBtn, activeTab === 'create' && styles.segmentBtnActiveCreate]}
          onPress={() => setActiveTab('create')}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <Plus size={15} color={activeTab === 'create' ? '#fff' : '#dc2626'} strokeWidth={2.5} />
            <Text style={[styles.segmentBtnText, activeTab === 'create' && styles.segmentBtnTextActiveCreate]}>
              إضافة بلاغ طارئ
            </Text>
          </View>
        </Pressable>
      </View>

      {/* ========================================================= */}
      {/* TAB 1: REPORTS & ALERTS LIST (قسم البلاغات)               */}
      {/* ========================================================= */}
      {activeTab === 'list' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset + 30 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadAlerts();
              }}
              tintColor="#dc2626"
              colors={['#dc2626']}
            />
          }
        >
          {/* Executive Overview Banner */}
          <LinearGradient
            colors={activeAlertsCount > 0 ? ['#dc2626', '#b91c1c', '#991b1b'] : ['#059669', '#047857', '#064e3b']}
            style={styles.heroBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroBannerContent}>
              <View style={styles.heroBannerIconWrap}>
                {activeAlertsCount > 0 ? (
                  <Flame size={26} color="#fff" />
                ) : (
                  <ShieldCheck size={26} color="#fff" />
                )}
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.heroBannerTitle}>
                  {activeAlertsCount > 0 ? 'تنبيهات واستجابة الطوارئ بالحي' : 'الحي آمن ومستقر بحمد الله'}
                </Text>
                <Text style={styles.heroBannerSub}>
                  {activeAlertsCount > 0
                    ? 'يتم إشعار جميع الجيران فوراً لتقديم المساعدة والتكاتف في الحالات الطارئة'
                    : 'لا توجد بلاغات طارئة نشطة حالياً. يمكنك الإبلاغ فوراً عند وجود أي طارئ'}
                </Text>
              </View>
            </View>

            {/* Quick Add Report Button inside Banner */}
            <Pressable
              style={styles.bannerActionBtn}
              onPress={() => setActiveTab('create')}
            >
              <Plus size={15} color={activeAlertsCount > 0 ? '#dc2626' : '#059669'} strokeWidth={3} />
              <Text style={[styles.bannerActionBtnText, { color: activeAlertsCount > 0 ? '#dc2626' : '#059669' }]}>
                إضافة بلاغ طارئ جديد
              </Text>
            </Pressable>
          </LinearGradient>

          {/* Status Filter Chips */}
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
                الكل ({alerts.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActiveDanger]}
              onPress={() => setStatusFilter('active')}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                <View style={styles.pulseDotRed} />
                <Text style={[styles.filterChipText, statusFilter === 'active' && styles.filterChipTextActiveDanger]}>
                  نشط الآن ({activeAlertsCount})
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.filterChip, statusFilter === 'resolved' && styles.filterChipActiveSuccess]}
              onPress={() => setStatusFilter('resolved')}
            >
              <Text style={[styles.filterChipText, statusFilter === 'resolved' && styles.filterChipTextActiveSuccess]}>
                تم حلها ✅ ({alerts.filter((a) => a.status === 'resolved').length})
              </Text>
            </Pressable>
          </View>

          {/* Alerts List */}
          {loadingAlerts && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#dc2626" />
              <Text style={styles.loadingText}>جارٍ جلب بلاغات الحي...</Text>
            </View>
          ) : filteredAlerts.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <ShieldCheck size={42} color="#059669" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد بلاغات مسجلة في هذا القسم</Text>
              <Text style={styles.emptySub}>
                الحي في أمان واستقرار. في حال حدوث أي طارئ (مفقودين، تسربات، سيارات مغلقة)، بادر بإبلاغ الجيران.
              </Text>
              <Pressable
                style={styles.emptyAddBtn}
                onPress={() => setActiveTab('create')}
              >
                <Plus size={16} color="#fff" strokeWidth={2.5} />
                <Text style={styles.emptyAddBtnText}>إضافة أول بلاغ طارئ</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {filteredAlerts.map((item) => {
                const isResolved = item.status === 'resolved';
                const typeObj = ALERT_TYPES.find((t) => t.id === item.alert_type) || ALERT_TYPES[4];
                const TypeIcon = typeObj.icon;
                const author = item.profiles;
                const isAuthor = currentUserId === item.creator_id;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.alertCard,
                      isResolved && styles.alertCardResolved,
                    ]}
                  >
                    {/* Top Row: Type & Status Badge */}
                    <View style={styles.alertCardHeader}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.alertTypeBadge, { backgroundColor: typeObj.bg }]}>
                          <TypeIcon size={14} color={typeObj.color} />
                          <Text style={[styles.alertTypeText, { color: typeObj.color }]}>
                            {typeObj.label}
                          </Text>
                        </View>
                      </View>

                      {isResolved ? (
                        <View style={styles.statusResolvedBadge}>
                          <CheckCircle2 size={12} color="#059669" />
                          <Text style={styles.statusResolvedText}>تم الحل بنجاح</Text>
                        </View>
                      ) : (
                        <View style={styles.statusActiveBadge}>
                          <View style={styles.pulseDotRed} />
                          <Text style={styles.statusActiveText}>نشط الآن</Text>
                        </View>
                      )}
                    </View>

                    {/* Alert Title & Description */}
                    <Text style={styles.alertTitle}>{item.title}</Text>
                    <Text style={styles.alertDescription}>{item.description}</Text>

                    {/* Metadata: Location & Time */}
                    <View style={styles.alertMetaRow}>
                      <View style={styles.metaItem}>
                        <Clock size={12} color="#64748b" />
                        <Text style={styles.metaText}>
                          {item.created_at ? relativeTime(item.created_at) : 'الآن'}
                        </Text>
                      </View>

                      {(item.district || item.city) && (
                        <View style={styles.metaItem}>
                          <MapPin size={12} color="#dc2626" />
                          <Text style={[styles.metaText, { color: '#0f172a', fontWeight: '700' }]}>
                            {[item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Author & Action Footer */}
                    <View style={styles.alertFooter}>
                      <View style={styles.authorSection}>
                        <View style={styles.authorAvatar}>
                          <Text style={styles.authorAvatarLetter}>
                            {(author?.display_name || author?.username || 'ج')[0]}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.authorName}>
                            {author?.display_name || author?.username || 'جار الحي'}
                          </Text>
                          <Text style={styles.authorSub}>ناشر البلاغ</Text>
                        </View>
                      </View>

                      <View style={styles.actionsGroup}>
                        <Pressable
                          style={styles.actionIconBtn}
                          onPress={() => handleShareAlert(item)}
                          accessibilityRole="button"
                          accessibilityLabel="مشاركة البلاغ"
                        >
                          <Share2 size={16} color="#475569" />
                        </Pressable>

                        {/* If own alert and active: resolve button */}
                        {isAuthor && !isResolved && (
                          <Pressable
                            style={styles.resolveActionBtn}
                            onPress={() => handleResolveAlert(item)}
                            disabled={resolvingId === item.id}
                          >
                            {resolvingId === item.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <CheckCircle2 size={14} color="#fff" />
                                <Text style={styles.resolveActionBtnText}>تم الحل</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        /* ========================================================= */
        /* TAB 2: CREATE EMERGENCY ALERT (إضافة بلاغ طارئ جديد)      */
        /* ========================================================= */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset + 30 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Card Notice */}
          <View style={styles.createIntroCard}>
            <View style={styles.createIntroHeader}>
              <View style={styles.pulseDotRedBig} />
              <Text style={styles.createIntroTitle}>بث بلاغ طارئ لسكان الحي 🚨</Text>
            </View>
            <Text style={styles.createIntroSub}>
              يُرسل هذا البلاغ كإشعار فوري لجميع جيرانك في الحي. يرجى توخي الدقة وتحديد الموقع بوضوح لمساعدة الجيران في التحرك فوراً.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>نوع الحالة الطارئة *</Text>
          <View style={styles.typesGrid}>
            {ALERT_TYPES.map((t) => {
              const isSelected = selectedType === t.id;
              const Icon = t.icon;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.typeCard,
                    { borderColor: isSelected ? t.color : '#e2e8f0', backgroundColor: isSelected ? t.bg : '#fff' },
                  ]}
                  onPress={() => setSelectedType(t.id)}
                >
                  <View style={[styles.typeIconBox, { backgroundColor: isSelected ? t.color : '#f1f5f9' }]}>
                    <Icon size={20} color={isSelected ? '#fff' : t.color} />
                  </View>
                  <Text style={[styles.typeLabel, isSelected && { color: t.color, fontWeight: '900' }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>عنوان التنبيه باختصار *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="مثال: طفل تائه بالقرب من حديقة الحي، يرتدي قميص أزرق"
            placeholderTextColor="#9ca3af"
            maxLength={100}
          />

          <Text style={styles.sectionLabel}>تفاصيل البلاغ والمعلومات المطلوبة *</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="يرجى كتابة التفاصيل الدقيقة: الوقت، الوصف، رقم التواصل، أو ما يحتاجه الجار في هذه اللحظة..."
            placeholderTextColor="#9ca3af"
            multiline
          />

          <Text style={styles.sectionLabel}>موقع الحالة في الحي</Text>
          <View style={styles.locationBox}>
            <TextInput
              style={styles.locationInput}
              value={locationLabel}
              onChangeText={setLocationLabel}
              placeholder="اسم الشارع، المربع، أو المعلم القريب..."
              placeholderTextColor="#9ca3af"
            />
            <Pressable
              style={styles.gpsBtn}
              onPress={handleFetchCurrentGps}
              disabled={fetchingLoc}
              accessibilityRole="button"
              accessibilityLabel="تحديد الموقع الجغرافي الحالي"
            >
              {fetchingLoc ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <MapPin size={18} color="#059669" />
              )}
            </Pressable>
          </View>

          <Pressable
            style={[styles.publishBtn, submitting && { opacity: 0.7 }]}
            onPress={handlePublishAlert}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Flame size={20} color="#fff" />
                <Text style={styles.publishBtnText}>بث التنبيه لجميع جيران الحي 🚨</Text>
              </>
            )}
          </Pressable>

          <View style={styles.disclaimerBox}>
            <AlertTriangle size={15} color="#b45309" />
            <Text style={styles.disclaimerText}>
              تنبيه: هذه الميزة مخصصة لحالات الطوارئ والمصلحة العامة بالحي. في الحالات الجنائية أو الإسعافية الخطرة يرجى الاتصال فوراً بالجهات الرسمية (911).
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  headerAddBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  headerViewListBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  headerViewListBtnText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },

  // Segment Container
  segmentContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnActiveCreate: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#0f172a',
    fontWeight: '900',
  },
  segmentBtnTextActiveCreate: {
    color: '#fff',
    fontWeight: '900',
  },
  activeAlertsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#dc2626',
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },

  // Hero Overview Banner
  heroBanner: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  heroBannerContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  heroBannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 3,
  },
  heroBannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  bannerActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bannerActionBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },

  // Filter Row
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  filterChipActiveDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  filterChipActiveSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
  filterChipTextActiveDanger: {
    color: '#dc2626',
    fontWeight: '900',
  },
  filterChipTextActiveSuccess: {
    color: '#16a34a',
    fontWeight: '900',
  },
  pulseDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dc2626',
  },
  pulseDotRedBig: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },

  // Alerts List Cards
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  alertCardResolved: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    opacity: 0.9,
  },
  alertCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertTypeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  alertTypeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusActiveBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  statusActiveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#dc2626',
  },
  statusResolvedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusResolvedText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#059669',
  },

  alertTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 22,
  },
  alertDescription: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    textAlign: 'right',
  },
  alertMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11.5,
    color: '#64748b',
  },

  alertFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 2,
  },
  authorSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarLetter: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
  },
  authorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  authorSub: {
    fontSize: 10,
    color: '#94a3b8',
  },

  actionsGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  resolveActionBtnText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Empty Box
  emptyBox: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  emptyAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 6,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },

  // Create Form Styles
  createIntroCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  createIntroHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  createIntroTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#dc2626',
  },
  createIntroSub: {
    fontSize: 12,
    color: '#991b1b',
    lineHeight: 17,
    textAlign: 'right',
  },

  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#1e293b', textAlign: 'right', marginTop: 6 },
  typesGrid: { gap: 8, marginBottom: 8 },
  typeCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  typeIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 13.5, fontWeight: '800', color: '#334155' },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0f172a',
    textAlign: 'right',
  },
  locationBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  locationInput: { flex: 1, height: 44, fontSize: 13, color: '#0f172a', textAlign: 'right' },
  gpsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },

  publishBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 14,
    shadowColor: '#dc2626',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  publishBtnText: { color: '#ffffff', fontSize: 14.5, fontWeight: '900' },

  disclaimerBox: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  disclaimerText: { fontSize: 11, color: '#92400e', lineHeight: 16, textAlign: 'right', flex: 1 },
});
