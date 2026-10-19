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
  Modal,
  KeyboardAvoidingView,
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
  Pencil,
  Trash2,
  X,
  Info,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { sendPushToMultipleUsers } from '@/lib/pushSender';
import { useBottomNavInset } from '@/lib/bottomNav';
import { relativeTime } from '@/lib/mapPins';
import { isInsideSaudiArabia, isKnownSaudiCity, normalizeSaudiLocationName } from '@/lib/saudiLocations';

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
  const [verifiedArea, setVerifiedArea] = useState<{ region: string; city: string; district: string } | null>(null);
  const [areaLoading, setAreaLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Edit & Delete states
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user && alive) {
          setCurrentUserId(data.user.id);
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
          if (alive) setUserProfile(prof);
        }
        // Use verified device GPS, not a profile default or a fabricated city/district.
        const device = await getCurrentDeviceLocation();
        if (device && isInsideSaudiArabia(device.latitude, device.longitude)) {
          const geo = await reverseGeocodeDeviceLocation(device);
          if (geo && !geo.isOutsideKSA && geo.region && geo.city && geo.district && isKnownSaudiCity(geo.city) && alive) {
            setVerifiedArea({ region: geo.region, city: geo.city, district: geo.district });
            setCoords({ lat: device.latitude, lng: device.longitude });
            setLocationLabel(`حي ${geo.district}، ${geo.city}`);
          }
        }
      } catch (e) {
        console.warn('Emergency location verification failed:', e);
      } finally {
        if (alive) setAreaLoading(false);
      }
      await loadAlerts();
    })();
    return () => { alive = false; };
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
      // Keep fetched rows separate; the visible list below applies the latest verified area state.
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
      if (!loc || !isInsideSaudiArabia(loc.latitude, loc.longitude)) {
        Alert.alert('تعذر تحديد موقعك', 'فعّل الموقع وتأكد أنك داخل المملكة ثم أعد المحاولة.');
        return;
      }
      const geo = await reverseGeocodeDeviceLocation(loc);
      if (!geo || geo.isOutsideKSA || !geo.region || !geo.city || !geo.district || !isKnownSaudiCity(geo.city)) {
        Alert.alert('موقع غير مكتمل', 'لم نستطع التحقق من المدينة والحي الحقيقيين. لن نستخدم بيانات افتراضية.');
        return;
      }
      setCoords({ lat: loc.latitude, lng: loc.longitude });
      setVerifiedArea({ region: geo.region, city: geo.city, district: geo.district });
      setLocationLabel(`حي ${geo.district}، ${geo.city}`);
      await loadAlerts();
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

    if (!coords || !verifiedArea?.city || !verifiedArea?.district) {
      return Alert.alert('تحديد الموقع مطلوب', 'اضغط تحديد موقعي أولاً حتى نربط البلاغ بمكانه الحقيقي ونرسله لجيران الحي الصحيح.');
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
              const live = await getCurrentDeviceLocation();
              if (!live || !isInsideSaudiArabia(live.latitude, live.longitude)) throw new Error('تعذر التحقق من GPS داخل المملكة. أعد تحديد موقعك.');
              const geo = await reverseGeocodeDeviceLocation(live);
              if (!geo || geo.isOutsideKSA || !geo.region || !geo.city || !geo.district || !isKnownSaudiCity(geo.city)) throw new Error('تعذر تأكيد المدينة والحي الفعليين. لم يتم إرسال البلاغ.');
              const city = geo.city;
              const district = geo.district;
              setCoords({ lat: live.latitude, lng: live.longitude });
              setVerifiedArea({ region: geo.region, city, district });
              setLocationLabel(`حي ${district}، ${city}`);

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
                  location_lat: live.latitude,
                  location_lng: live.longitude,
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
                .eq('city', city)
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

  const MAX_EDITS = 2;

  const handleOpenEdit = (alertItem: any) => {
    const editCount = alertItem.edit_count || 0;
    const editsRemaining = Math.max(0, MAX_EDITS - editCount);
    if (editsRemaining <= 0) {
      Alert.alert(
        'استنفاد محاولات التعديل ⚠️',
        'تم استنفاد الحد الأقصى المسموح للتعديل (محاولتان فقط) حفاظاً على مصداقية وسياق البلاغات الطارئة.'
      );
      return;
    }
    setEditingAlert(alertItem);
    setEditTitle(alertItem.title || '');
    setEditDescription(alertItem.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    if (!editTitle.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة عنوان البلاغ.');
    }
    if (!editDescription.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى توضيح تفاصيل البلاغ.');
    }

    const editCount = editingAlert.edit_count || 0;
    const nextEditCount = editCount + 1;

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('urgent_alerts')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim(),
          edit_count: nextEditCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingAlert.id);

      if (error) throw error;

      setEditingAlert(null);
      Alert.alert(
        'تم حفظ التعديل بنجاح ✅',
        `متبقي لك ${MAX_EDITS - nextEditCount} من أصل ${MAX_EDITS} محاولات تعديل.`
      );
      loadAlerts();
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل البلاغ.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAlert = (alertItem: any) => {
    Alert.alert(
      'حذف البلاغ نهائياً ⚠️',
      'هل أنت متأكد من رغبتك في حذف هذا البلاغ الطارئ؟ لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            setDeletingAlertId(alertItem.id);
            try {
              const { error } = await supabase
                .from('urgent_alerts')
                .delete()
                .eq('id', alertItem.id);

              if (error) throw error;

              Alert.alert('تم الحذف', 'تم حذف البلاغ بنجاح.');
              loadAlerts();
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر حذف البلاغ.');
            } finally {
              setDeletingAlertId(null);
            }
          },
        },
      ]
    );
  };

  const localAlerts = alerts.filter((item: any) =>
    Boolean(verifiedArea) &&
    normalizeSaudiLocationName(String(item.city || '')) === normalizeSaudiLocationName(verifiedArea!.city) &&
    normalizeSaudiLocationName(String(item.district || '')) === normalizeSaudiLocationName(verifiedArea!.district) &&
    Number.isFinite(Number(item.location_lat)) && Number.isFinite(Number(item.location_lng)) &&
    isInsideSaudiArabia(Number(item.location_lat), Number(item.location_lng))
  );
  const activeAlertsCount = localAlerts.filter((a) => a.status === 'active').length;
  const filteredAlerts = localAlerts.filter((a) => {
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
              🚨 قسم البلاغات ({localAlerts.length})
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
          <View style={{ marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: verifiedArea ? '#ecfdf5' : '#fff7ed', borderWidth: 1, borderColor: verifiedArea ? '#a7f3d0' : '#fed7aa' }}>
            <Text style={{ color: verifiedArea ? '#065f46' : '#9a3412', textAlign: 'right', fontWeight: '800', fontSize: 12 }}>
              {areaLoading ? 'جارٍ التحقق من موقعك الحقيقي…' : verifiedArea ? `نطاق البلاغات: حي ${verifiedArea.district}، ${verifiedArea.city}` : 'لم يتم التحقق من موقعك؛ لا يمكن عرض بلاغات حي محدد حتى يتم تحديد الموقع.'}
            </Text>
            {verifiedArea && <Text style={{ color: '#64748b', textAlign: 'right', fontSize: 10, marginTop: 4 }}>بلاغات مجتمعية مرتبطة بموقع GPS؛ ليست تأكيدًا رسميًا من جهات الطوارئ.</Text>}
            {!verifiedArea && !areaLoading && <Pressable onPress={() => void handleFetchCurrentGps()} style={{ alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#9a3412' }}><Text style={{ color: '#fff', fontWeight: '800' }}>تحديد موقعي الحقيقي</Text></Pressable>}
          </View>

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
                الكل ({localAlerts.length})
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
                تم حلها ✅ ({localAlerts.filter((a) => a.status === 'resolved').length})
              </Text>
            </Pressable>
          </View>

          {/* Alerts List */}
          {loadingAlerts && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#dc2626" />
              <Text style={styles.loadingText}>جارٍ جلب بلاغات الحي...</Text>
            </View>
          ) : areaLoading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" color="#dc2626" /><Text style={styles.loadingText}>جارٍ التحقق من موقعك قبل عرض البلاغات…</Text></View>
          ) : !verifiedArea ? (
            <View style={styles.emptyBox}><MapPin size={36} color="#d97706" /><Text style={styles.emptyTitle}>حدد موقعك لعرض البلاغات المحلية</Text><Text style={styles.emptySub}>لن نعرض بلاغات من أحياء أخرى أو مواقع غير مؤكدة.</Text><Pressable style={styles.emptyAddBtn} onPress={() => void handleFetchCurrentGps()}><Text style={styles.emptyAddBtnText}>تحديد موقعي</Text></Pressable></View>
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
                const editCount = item.edit_count || 0;
                const editsRemaining = Math.max(0, MAX_EDITS - editCount);

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

                    {/* Author Management Bar: Edit (Limit 2) & Delete */}
                    {isAuthor && (
                      <View style={styles.authorBar}>
                        <View style={[styles.editLimitBadge, editsRemaining === 0 ? styles.editLimitBadgeExpired : styles.editLimitBadgeActive]}>
                          <Text style={[styles.editLimitBadgeText, editsRemaining === 0 ? styles.editLimitBadgeTextExpired : styles.editLimitBadgeTextActive]}>
                            {editsRemaining}/{MAX_EDITS} محاولات
                          </Text>
                        </View>

                        <View style={styles.authorBtnsRow}>
                          <Pressable
                            style={[styles.authorEditBtn, editsRemaining === 0 && styles.authorBtnDisabled]}
                            onPress={() => handleOpenEdit(item)}
                            disabled={editsRemaining === 0}
                          >
                            <Pencil size={13} color={editsRemaining === 0 ? '#94a3b8' : '#047857'} />
                            <Text style={[styles.authorEditBtnText, editsRemaining === 0 && styles.authorBtnDisabledText]}>
                              تعديل
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.authorDeleteBtn}
                            onPress={() => handleDeleteAlert(item)}
                            disabled={deletingAlertId === item.id}
                          >
                            {deletingAlertId === item.id ? (
                              <ActivityIndicator size="small" color="#dc2626" />
                            ) : (
                              <>
                                <Trash2 size={13} color="#dc2626" />
                                <Text style={styles.authorDeleteBtnText}>حذف</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    )}
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

      {/* Modal for Editing Emergency Alert */}
      <Modal
        visible={Boolean(editingAlert)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingAlert(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>تعديل البلاغ الطارئ</Text>
                <Text style={styles.modalSubtitle}>
                  محاولة {(editingAlert?.edit_count || 0) + 1} من {MAX_EDITS} (متبقي بعدها {Math.max(0, MAX_EDITS - ((editingAlert?.edit_count || 0) + 1))})
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setEditingAlert(null)}
                disabled={savingEdit}
              >
                <X size={18} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalInputLabel}>عنوان البلاغ</Text>
              <TextInput
                style={styles.modalInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="عنوان مختصر للبلاغ الطارئ..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                maxLength={100}
              />

              <Text style={styles.modalInputLabel}>تفاصيل البلاغ والملاحظات</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="وضح التفاصيل والموقع بدقة لمساعدة الجيران..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                multiline
                numberOfLines={4}
                maxLength={500}
              />

              <View style={styles.editWarningBox}>
                <Info size={14} color="#d97706" />
                <Text style={styles.editWarningText}>
                  تنبيه: يُسمح بتعديل البلاغ مرتين كحد أقصى حفاظاً على مصداقية وسياق التنبيهات في الحي.
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalCancelBtn, savingEdit && { opacity: 0.6 }]}
                onPress={() => setEditingAlert(null)}
                disabled={savingEdit}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalSubmitBtn, (!editTitle.trim() || !editDescription.trim() || savingEdit) && styles.modalSubmitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editDescription.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  authorBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  authorBtnsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  authorEditBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  authorEditBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  authorDeleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  authorDeleteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  authorBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  authorBtnDisabledText: {
    color: '#94a3b8',
  },
  editLimitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  editLimitBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  editLimitBadgeExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  editLimitBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  editLimitBadgeTextActive: {
    color: '#047857',
  },
  editLimitBadgeTextExpired: {
    color: '#b91c1c',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 10,
  },
  modalInputLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    textAlign: 'right',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editWarningBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  editWarningText: {
    fontSize: 11.5,
    color: '#92400e',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    lineHeight: 17,
  },
  modalFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  modalSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
});
