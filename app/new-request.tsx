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
  AlertCircle,
  Banknote,
  HeartHandshake,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LocationSelectorModal from '@/components/LocationSelectorModal';

export default function NewRequest() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [budget, setBudget] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  useEffect(() => {
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
    if (!title.trim()) {
      return Alert.alert('تنبيه', 'يرجى كتابة عنوان مختصر لطلبك.');
    }
    if (!description.trim()) {
      return Alert.alert('تنبيه', 'يرجى شرح التفاصيل وما تحتاجه من جيرانك.');
    }

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setBusy(false);
        return router.replace('/auth');
      }

      const payload = {
        requester_id: u.user.id,
        title: title.trim(),
        description: description.trim(),
        request_type: 'help',
        city: city.trim() || null,
        district: district.trim() || null,
        budget: budget ? Number(budget) : null,
        is_urgent: urgent,
        status: 'open',
      };

      const { data, error } = await supabase.from('requests').insert(payload).select('id').single();
      setBusy(false);

      if (error) {
        Alert.alert('خطأ', error.message);
      } else {
        Alert.alert('تم بنجاح! 🤝', 'تم نشر طلبك لأهالي الحي وسيتواصل معك من يقدر على المساعدة.');
        router.replace({ pathname: '/request', params: { id: data.id } });
      }
    } catch (e: any) {
      setBusy(false);
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء نشر الطلب.');
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#0891b2', '#0e7490', '#0f172a']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>إضافة طلب فزعة 🤝</Text>
            <View style={{ width: 28 }} />
          </View>
          <Text style={styles.heroSub}>
            اطلب مساعدة، توصيل، إعارة غرض، أو فزعة من أهل حيك.
          </Text>
        </LinearGradient>

        <View style={styles.formCard}>
          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>عنوان الطلب *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: أحتاج أحد يجيب لي غرض، توصيل سريع، استعارة دريل..."
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>الحي والمدينة</Text>
            <Pressable style={styles.locationBtn} onPress={() => setShowLocationModal(true)}>
              <MapPin size={18} color="#0891b2" />
              <Text style={styles.locationBtnText}>
                {city ? `${city}${district ? ` · حي ${district}` : ''}` : 'حدد الحي لتوجيه الطلب لجيرانك...'}
              </Text>
            </Pressable>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>تفاصيل ما تحتاجه *</Text>
            <View style={[styles.inputContainer, { height: 120, alignItems: 'flex-start' }]}>
              <TextInput
                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="اشرح المطلوب بدقة، التوقيت، وأي ملاحظات تساعد جيرانك على تلبيته..."
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Budget */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>الميزانية المقترحة / أتعاب المساعدة (اختياري)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                placeholder="مثال: 30 (اتركه فارغاً إذا كان فزعة وتطوع)"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Urgent Switch */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                <Text style={styles.switchTitle}>طلب عاجل وفوري 🚨</Text>
              </View>
              <Text style={styles.switchSub}>يظهر الطلب باللون الأحمر في أعلى قائمة الحي لتنبيه الجيران</Text>
            </View>
            <Switch
              value={urgent}
              onValueChange={setUrgent}
              trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
              thumbColor={urgent ? '#dc2626' : '#9ca3af'}
            />
          </View>

          {/* Submit */}
          <Pressable
            style={[styles.submitBtn, busy && { opacity: 0.6 }]}
            onPress={save}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>نشر الطلب في حيّنا ✨</Text>
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
    backgroundColor: '#0891b2',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0891b2',
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
