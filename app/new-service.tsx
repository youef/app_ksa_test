import { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  ChevronRight,
  MapPin,
  Tag,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Briefcase,
  Info,
  X,

} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { getPermanentMyLocation, savePermanentMyLocation, isAllKingdom } from '@/lib/locationSync';

export default function NewService() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('صيانة منزلية');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const categories = [
    'صيانة منزلية',
    'كهرباء وسباكة',
    'توصيل ونقل',
    'تعليم ودروس',
    'تصميم وبرمجة',
    'طبخ وضيافة',
    'أخرى',
  ];

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setAuthChecking(false);
        router.replace('/auth');
        return;
      }
      const loc = await getPermanentMyLocation();
      if (loc?.city && !isAllKingdom(loc.city)) {
        if (loc.region) setRegion(loc.region);
        setCity(loc.city);
        if (loc.district && loc.district !== 'كل الأحياء' && loc.district !== 'كل أحياء المدينة') {
          setDistrict(loc.district);
        }
      }

      // Autofill city and district from profile if logged in
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('region, city, district')
          .eq('id', u.user.id)
          .single();
        if (p?.region) setRegion(p.region);
        if (p?.city) {
          setCity(p.city);
          if (p?.district) setDistrict(p.district);
          await savePermanentMyLocation({ city: p.city, district: p.district || 'كل الأحياء' });
        }
      }
      setAuthChecking(false);
    })();
  }, []);

  async function save() {
    if (!name.trim()) {
      return Alert.alert('تنبيه', 'يرجى كتابة اسم أو عنوان الخدمة.');
    }
    if (!description.trim()) {
      return Alert.alert('تنبيه', 'يرجى كتابة تفاصيل وما يشمله عرض خدمتك.');
    }
    if (price && (!/^\d+(\.\d{1,2})?$/.test(price.trim()) || Number(price) < 0)) {
      return Alert.alert('تنبيه', 'اكتب سعراً صحيحاً مثل 50 أو 75.50.');
    }

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setBusy(false);
        return router.replace('/auth');
      }

      // Keep the selected service area aligned with the profile because the services RLS policy
      // validates the provider's city/district against the profile location.
      if (city.trim() || district.trim() || region.trim()) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            region: region.trim() || null,
            city: city.trim() || null,
            district: district.trim() || null,
          })
          .eq('id', u.user.id);
        if (profileError) throw profileError;
      }

      const payload = {
        provider_id: userId,
        name: name.trim(),
        description: description.trim(),
        category,
        city: city.trim() || null,
        district: district.trim() || null,
        price_from: price ? Number(price) : null,
        available_now: available,
      };

      const { data, error } = await supabase.from('services').insert(payload).select('id').single();
      setBusy(false);

      if (error) {
        Alert.alert('تعذر نشر الخدمة', error.message);
      } else {
        Alert.alert('تم بنجاح! 🎉', 'تم نشر خدمتك في دليل خدمات الحي.');
        router.replace({ pathname: '/service', params: { id: data.id } });
      }
    } catch (e: any) {
      setBusy(false);
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء حفظ الخدمة.');
    }
  }

  if (authChecking) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>نجهز صفحة إضافة الخدمة…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.replace('/market')} style={styles.iconBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>إضافة خدمة جديدة 🛠️</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.heroIntroRow}>
            <View style={styles.heroIcon}><Briefcase size={20} color="#d1fae5" /></View>
            <Text style={styles.heroSub}>
              اعرض خدماتك وخبراتك واستقبل طلبات واستفسارات جيرانك مباشرة.
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.formCard}>
          <View style={styles.formTopRow}>
            <View style={styles.formBadge}><Sparkles size={15} color="#059669" /><Text style={styles.formBadgeText}>عرضك يظهر لجيرانك</Text></View>
            <Pressable onPress={() => setShowTips(v => !v)} style={styles.tipBtn}>
              {showTips ? <X size={17} color="#64748b" /> : <Info size={17} color="#64748b" />}
            </Pressable>
          </View>
          {showTips && (
            <View style={styles.tipsBox}>
              <Text style={styles.tipText}>اكتب عنواناً واضحاً، حدّد نطاق خدمتك، وأضف تفاصيل عملية تساعد الجيران على التواصل معك.</Text>
            </View>
          )}
          {/* Service Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>عنوان الخدمة *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="مثال: فني تكييف وكهرباء، معلم لغة إنجليزية..."
                placeholderTextColor="#9ca3af"
                maxLength={80}
              />
            </View>
          </View>

          {/* Category Picker */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}><Briefcase size={15} color="#059669" /><Text style={styles.label}>التصنيف</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {categories.map(c => (
                <Pressable
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Location Picker */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}><MapPin size={15} color="#059669" /><Text style={styles.label}>نطاق الخدمة والحي</Text></View>
            <Pressable style={styles.locationBtn} onPress={() => setShowLocationModal(true)}>
              <MapPin size={18} color="#059669" />
              <Text style={styles.locationBtnText}>
                {city ? `${city}${district ? ` · حي ${district}` : ''}` : 'اختر مدينتك وحيك...'}
              </Text>
            </Pressable>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}><Info size={15} color="#059669" /><Text style={styles.label}>تفاصيل الخدمة *</Text></View>
            <View style={[styles.inputContainer, { height: 120, alignItems: 'flex-start' }]}>
              <TextInput
                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="اشرح ما تقدمه، أوقات العمل، وخبراتك السابقة في الحي..."
                placeholderTextColor="#9ca3af"
                maxLength={500}
              />
            </View>
          </View>

          {/* Price */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}><DollarSign size={15} color="#059669" /><Text style={styles.label}>السعر المبدئي (ريال سعودي - اختياري)</Text></View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="مثال: 50 (اتركه فارغاً إذا كان حسب الاتفاق)"
                placeholderTextColor="#9ca3af"
                maxLength={8}
              />
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{name.trim().length}/80 عنوان</Text>
            <Text style={styles.progressText}>{description.trim().length}/500 تفاصيل</Text>
          </View>

          {/* Availability Switch */}
          <View style={styles.publishNote}>
            <CheckCircle2 size={17} color="#059669" />
            <Text style={styles.publishNoteText}>سيتم حفظ نطاق الخدمة مع ملفك ليظهر بشكل صحيح لجيرانك.</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.switchTitle}>جاهز للعمل ومتاح حالياً</Text>
              <Text style={styles.switchSub}>يظهر وسم "متاح الآن" لجيرانك في قائمة الخدمات</Text>
            </View>
            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
              thumbColor={available ? '#059669' : '#9ca3af'}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={[styles.submitBtn, busy && { opacity: 0.6 }]}
            onPress={save}
            disabled={busy || authChecking}
            accessibilityRole="button"
            accessibilityLabel="نشر الخدمة في حيّنا"
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>نشر الخدمة في حيّنا ✨</Text>
            )}
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Location Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={city}
        selectedDistrict={district}
        onSelect={async (reg, c, d) => {
          const cleanCity = c === 'كل المدن' ? '' : c;
          const cleanDist = (d === 'كل أحياء المدينة' || d === 'كل الأحياء') ? '' : d;
          setRegion(reg || '');
          setCity(cleanCity);
          setDistrict(cleanDist);
          if (cleanCity) {
            await savePermanentMyLocation({
              region: reg,
              city: cleanCity,
              district: cleanDist || 'كل الأحياء',
            });
            const { data: u } = await supabase.auth.getUser();
            if (u.user) {
              await supabase.from('profiles').update({ region: reg || null, city: cleanCity, district: cleanDist || 'كل الأحياء' }).eq('id', u.user.id);
            }
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 20,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  navBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBtn: {
    padding: 6,
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
  },
  heroIntroRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: -10,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  formTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  formBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  formBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  tipBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tipsBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  tipText: {
    color: '#166534',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right',
    width: '100%',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chipText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  locationBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  progressText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  publishNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 14,
  },
  publishNoteText: {
    flex: 1,
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 17,
  },
  switchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
    gap: 12,
  },
  switchTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  switchSub: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});

// Production build trigger: service publishing permissions fixed.
