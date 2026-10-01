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
import { C } from '@/lib/ui';
import {
  ChevronRight,
  Plus,
  MapPin,
  Tag,
  DollarSign,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LocationSelectorModal from '@/components/LocationSelectorModal';

export default function NewService() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('صيانة منزلية');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [price, setPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

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
    // Autofill city and district from profile
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (u.user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('city, district')
          .eq('id', u.user.id)
          .single();
        if (p?.city) setCity(p.city);
        if (p?.district) setDistrict(p.district);
      }
    });
  }, []);

  async function save() {
    if (!name.trim()) {
      return Alert.alert('تنبيه', 'يرجى كتابة اسم أو عنوان الخدمة.');
    }
    if (!description.trim()) {
      return Alert.alert('تنبيه', 'يرجى كتابة تفاصيل وما يشمله عرض خدمتك.');
    }

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setBusy(false);
        return router.replace('/auth');
      }

      const payload = {
        provider_id: u.user.id,
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
        Alert.alert('خطأ', error.message);
      } else {
        Alert.alert('تم بنجاح! 🎉', 'تم نشر خدمتك في دليل خدمات الحي.');
        router.replace({ pathname: '/service', params: { id: data.id } });
      }
    } catch (e: any) {
      setBusy(false);
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء حفظ الخدمة.');
    }
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
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>إضافة خدمة جديدة 🛠️</Text>
            <View style={{ width: 28 }} />
          </View>
          <Text style={styles.heroSub}>
            اعرض خدماتك وخبراتك واستقبل طلبات واستفسارات جيرانك مباشرة.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
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
              />
            </View>
          </View>

          {/* Category Picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>التصنيف</Text>
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
            <Text style={styles.label}>نطاق الخدمة والحي</Text>
            <Pressable style={styles.locationBtn} onPress={() => setShowLocationModal(true)}>
              <MapPin size={18} color="#0891b2" />
              <Text style={styles.locationBtnText}>
                {city ? `${city}${district ? ` · حي ${district}` : ''}` : 'اختر مدينتك وحيك...'}
              </Text>
            </Pressable>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>تفاصيل الخدمة *</Text>
            <View style={[styles.inputContainer, { height: 120, alignItems: 'flex-start' }]}>
              <TextInput
                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="اشرح ما تقدمه، أوقات العمل، وخبراتك السابقة في الحي..."
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>السعر المبدئي (ريال سعودي - اختياري)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="مثال: 50 (اتركه فارغاً إذا كان حسب الاتفاق)"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Availability Switch */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.switchTitle}>جاهز للعمل ومتاح حالياً</Text>
              <Text style={styles.switchSub}>يظهر وسم "متاح الآن" لجيرانك في قائمة الخدمات</Text>
            </View>
            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{ false: '#e2e8f0', true: '#bae6fd' }}
              thumbColor={available ? '#0891b2' : '#9ca3af'}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={[styles.submitBtn, busy && { opacity: 0.6 }]}
            onPress={save}
            disabled={busy}
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
        onSelect={(reg, c, d) => {
          setCity(c === 'كل المدن' ? '' : c);
          setDistrict(d === 'كل أحياء المدينة' ? '' : d);
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 8,
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
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
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
