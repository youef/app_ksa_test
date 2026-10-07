import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { sendPushToMultipleUsers } from '@/lib/pushSender';

const ALERT_TYPES = [
  { id: 'missing', label: 'طفل أو شخص مفقود', icon: UserX, color: '#dc2626', bg: '#fef2f2' },
  { id: 'water_leak', label: 'تسرب مياه رئيسي', icon: Droplets, color: '#0284c7', bg: '#f0f9ff' },
  { id: 'car_blocked', label: 'سيارة تغلق مخرج أو شارع', icon: Car, color: '#d97706', bg: '#fffbeb' },
  { id: 'fire_hazard', label: 'حريق أو التماس كهربائي', icon: Flame, color: '#e11d48', bg: '#fff1f2' },
  { id: 'general', label: 'أمر طارئ آخر', icon: HelpCircle, color: '#475569', bg: '#f8fafc' },
];

export default function EmergencyAlertScreen() {
  const [selectedType, setSelectedType] = useState('missing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
        setUserProfile(prof);
        if (prof?.district) {
          setLocationLabel(`حي ${prof.district}، ${prof.city || 'الرياض'}`);
        }
      }
    });
  }, []);

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
      return Alert.alert('تسجيل الدخول مطلوب', 'يرجى تسجيل الدخول لبث تنبيه في الحي.');
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
              const district = userProfile?.district || 'العليا';
              const city = userProfile?.city || 'الرياض';

              // 1. Insert alert in database
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

              // 2. Fetch neighbors in the same district to send push notifications
              const { data: neighbors } = await supabase
                .from('profiles')
                .select('id')
                .eq('district', district)
                .neq('id', auth.user.id)
                .limit(100);

              if (neighbors && neighbors.length > 0) {
                const neighborIds = neighbors.map(n => n.id);
                void sendPushToMultipleUsers(neighborIds, {
                  title: `🚨 تنبيه عاجل في حي ${district}!`,
                  body: title.trim(),
                  data: { url: '/home' },
                  sound: 'default',
                });
              }

              Alert.alert('تم بث التنبيه بنجاح 🚨', 'تم إشعار سكان الحي فوراً للمساعدة.', [
                { text: 'العودة للرئيسية', onPress: () => router.replace('/home') },
              ]);
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#991b1b', '#b91c1c', '#dc2626']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <ChevronRight size={22} color="#ffffff" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <View style={styles.heroBadge}>
              <ShieldAlert size={14} color="#fee2e2" />
              <Text style={styles.heroBadgeText}>للحالات العاجلة فقط</Text>
            </View>
            <Text style={styles.heroTitle}>تنبيه الحي العاجل 🚨</Text>
          </View>
        </View>
        <Text style={styles.heroSubtitle}>
          أداة تكاتف مخصصة للحالات الطارئة التي تتطلب مساعدة فورية من سكان الحي.
        </Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>نوع الحالة الطارئة:</Text>
        <View style={styles.typesGrid}>
          {ALERT_TYPES.map(t => {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'flex-end' },
  heroBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: '#fee2e2' },
  heroTitle: { fontSize: 21, fontWeight: '900', color: '#fff', textAlign: 'right' },
  heroSubtitle: { fontSize: 12.5, color: '#fecaca', lineHeight: 18, textAlign: 'right', marginTop: 6 },

  scroll: { flex: 1 },
  scrollContent: { padding: 18, gap: 10 },
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
