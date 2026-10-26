import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Check, ChevronRight, LocateFixed, MapPin, Search, ShieldCheck, X } from 'lucide-react-native';
import {
  buildSaudiLocations, normalizeSaudiLocationName, type City, type Region,
} from '@/lib/saudiLocations';
import {
  getLockedCity, getActiveLocation, savePermanentMyLocation,
  type HaynaLocation, type LockedCity,
} from '@/lib/locationSync';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';

type CityOption = { name: string; region: string; districts: string[] };
type Props = {
  visible: boolean;
  city: string;
  district: string;
  region: string;
  onClose: () => void;
  onSaved: (location: HaynaLocation) => void;
};

function withoutPrefix(value: string) {
  return value.trim().replace(/^حي\s+/u, '');
}

const CITY_OPTIONS: CityOption[] = (() => {
  const regions = buildSaudiLocations();
  return regions.flatMap((region: Region) =>
    region.cities.map((city: City) => ({
      name: city.name,
      region: region.name,
      districts: Array.from(new Set(city.districts.map(d => withoutPrefix(d.name)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ar')),
    })),
  );
})();
const matches = (left: string, right: string) =>
  normalizeSaudiLocationName(left) === normalizeSaudiLocationName(right);

export default function PublishLocationEditor({ visible, city, district, region, onClose, onSaved }: Props) {
  const [draftCity, setDraftCity] = useState(city);
  const [draftDistrict, setDraftDistrict] = useState(district);
  const [draftRegion, setDraftRegion] = useState(region);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [chooseCity, setChooseCity] = useState(false);
  const [lockedCity, setLockedCity] = useState<LockedCity | null>(null);
  const [gpsConfirmedCity, setGpsConfirmedCity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setDraftCity(city);
    setDraftDistrict(district);
    setDraftRegion(region);
    setCitySearch('');
    setDistrictSearch('');
    setChooseCity(!city);
    setLockedCity(null);
    setGpsConfirmedCity(false);
    setError('');
    void getLockedCity().then(lock => {
      if (!active) return;
      setLockedCity(lock);
      if (lock && !matches(city, lock.city)) {
        setDraftCity(lock.city);
        setDraftRegion(lock.region);
        setDraftDistrict('');
        setChooseCity(false);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [visible, city, district, region]);

  const selectedCity = useMemo(() => CITY_OPTIONS.find(item => matches(item.name, draftCity)), [draftCity]);
  const districts = selectedCity?.districts || [];
  const filteredDistricts = useMemo(
    () => districts.filter(item => normalizeSaudiLocationName(item).includes(normalizeSaudiLocationName(districtSearch)))
      .slice(0, 80),
    [districts, districtSearch],
  );
  const searchedCities = useMemo(
    () => CITY_OPTIONS.filter(item =>
      !citySearch.trim() || normalizeSaudiLocationName(item.name).includes(normalizeSaudiLocationName(citySearch)),
    ).slice(0, 24),
    [citySearch],
  );
  const canSave = Boolean(draftCity && selectedCity && draftDistrict.trim());

  function chooseLocation(item: CityOption) {
    if (lockedCity && !matches(item.name, lockedCity.city)) {
      setError('المدينة مرتبطة بموقع GPS الموثّق. اختر حيًا في مدينتك، أو استخدم تحديد الموقع الحالي لتحديث المدينة.');
      return;
    }
    setGpsConfirmedCity(false);
    setDraftCity(item.name);
    setDraftRegion(item.region);
    setDraftDistrict('');
    setDistrictSearch('');
    setChooseCity(false);
    setError('');
  }

  async function detectLocation() {
    if (loading || saving) return;
    setLoading(true);
    setError('');
    try {
      const coords = await getCurrentDeviceLocation();
      if (!coords) {
        setError('تعذر تحديد الموقع. فعّل إذن الموقع أو اختر الحي يدويًا.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(coords);
      if (!place || place.isOutsideKSA || !place.city) {
        setError('لم نحصل على اسم مدينة سعودية موثوقة. يمكنك تحديد الحي يدويًا.');
        return;
      }
      const matchingCity = CITY_OPTIONS.find(item => matches(item.name, place.city));
      if (!matchingCity) {
        setError('لم نجد المدينة في دليل الأحياء. جرّب اختيار المدينة يدويًا.');
        return;
      }
      setDraftCity(matchingCity.name);
      setDraftRegion(matchingCity.region);
      const fromGps = matchingCity.districts.find(item => matches(item, place.district || ''));
      setDraftDistrict(fromGps || '');
      setDistrictSearch('');
      setChooseCity(false);
      setGpsConfirmedCity(true);
      setLockedCity({ city: matchingCity.name, region: matchingCity.region });
      // Do not store the device coordinates. A verified GPS city can move a city lock.
      // Saving happens only when the user confirms the selected district.
      setError(fromGps ? '' : 'حدد حيّك من القائمة لتأكيد موقع النشر.');
    } catch {
      setError('تعذر تحديد الموقع الآن. جرّب اختيار حيّك يدويًا.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (saving || !canSave || !selectedCity) return;
    if (lockedCity && !matches(draftCity, lockedCity.city)) {
      setError('المدينة مختلفة عن المدينة الموثقة. حدّد الموقع الحالي أو اختر حيًا من مدينتك.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = {
        city: selectedCity.name,
        region: selectedCity.region,
        district: withoutPrefix(draftDistrict.trim()),
      };
      await savePermanentMyLocation(next, true, { allowCityChange: gpsConfirmedCity });
      const actual = await getActiveLocation();
      if (!matches(actual.city, next.city) || !matches(actual.district, next.district)) {
        setError('تعذر حفظ الموقع المطلوب بسبب قيود الموقع الموثق. حاول مجددًا.');
        return;
      }
      onSaved(actual);
      onClose();
    } catch (cause) {
      // The storage layer may have saved locally before profile sync fails.
      const actual = await getActiveLocation();
      if (matches(actual.city, draftCity) && matches(actual.district, draftDistrict)) onSaved(actual);
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث موقع الحساب. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.outside} onPress={onClose} accessibilityLabel="إغلاق تعديل الموقع" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={styles.close}><X size={21} color="#49685B" /></Pressable>
            <View style={styles.headerText}>
              <Text style={styles.heading}>تحديث منطقة النشر</Text>
              <Text style={styles.subheading}>اختر المدينة والحي دون مغادرة منشورك</Text>
            </View>
            <View style={styles.headerIcon}><MapPin size={21} color="#047857" /></View>
          </View>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <Pressable accessibilityRole="button" disabled={loading || saving} onPress={() => void detectLocation()} style={styles.gps}>
              {loading ? <ActivityIndicator color="#047857" /> : <LocateFixed size={21} color="#047857" />}
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsTitle}>تحديد المدينة والحي تلقائيًا</Text>
                <Text style={styles.gpsDescription}>باستخدام إذن الموقع؛ دون نشر إحداثياتك في المنشور</Text>
              </View>
            </Pressable>

            <Text style={styles.label}>المدينة</Text>
            <Pressable accessibilityRole="button" disabled={Boolean(lockedCity) || saving} onPress={() => setChooseCity(v => !v)} style={styles.field}>
              <Text style={styles.fieldValue}>{draftCity || 'اختر مدينة'}</Text>
              <ChevronRight size={17} color="#647C6B" />
            </Pressable>
            {lockedCity ? <Text style={styles.lockHint}>مدينتك موثّقة بالموقع: {lockedCity.city}. يمكنك تغيير الحي مباشرة.</Text> : null}
            {chooseCity && !lockedCity ? (
              <View style={styles.optionsBox}>
                <View style={styles.searchBox}><Search size={18} color="#647C6B" /><TextInput value={citySearch} onChangeText={setCitySearch} placeholder="ابحث عن مدينتك" placeholderTextColor="#869A90" style={styles.searchInput} textAlign="right" /></View>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 230 }}>
                {searchedCities.map((item, idx) => (
                  <Pressable key={item.region + ':' + item.name + ':' + idx} onPress={() => chooseLocation(item)} style={styles.option}>
                    <Text style={styles.optionText}>{item.name} <Text style={styles.optionRegion}>· {item.region}</Text></Text>
                    {matches(item.name, draftCity) ? <Check size={17} color="#047857" /> : null}
                  </Pressable>
                ))}
                {searchedCities.length === 0 ? <Text style={styles.empty}>لا توجد مدينة مطابقة.</Text> : null}
                </ScrollView>
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 16 }]}>الحي <Text style={{ color: '#B45309' }}>(مطلوب)</Text></Text>
            {draftCity ? (
              <View style={styles.optionsBox}>
                <View style={styles.searchBox}><Search size={18} color="#647C6B" /><TextInput value={districtSearch} onChangeText={setDistrictSearch} placeholder="ابحث عن اسم الحي" style={styles.searchInput} placeholderTextColor="#869A90" textAlign="right" /></View>
                <View style={styles.selectedLocation}><Text style={styles.selectedText}>{draftDistrict ? 'الحي المحدد: ' + draftDistrict : 'اختر الحي الأقرب لمنطقة سكنك'}</Text></View>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 235 }}>
                {filteredDistricts.map((item, idx) => (
                  <Pressable key={item + ':' + idx} onPress={() => { setDraftDistrict(item); setError(''); }} style={[styles.option, matches(item, draftDistrict) && styles.optionSelected]}>
                    <Text style={[styles.optionText, matches(item, draftDistrict) && { color: '#047857' }]}>{item}</Text>
                    {matches(item, draftDistrict) ? <Check size={17} color="#047857" /> : null}
                  </Pressable>
                ))}
                {filteredDistricts.length === 0 ? <Text style={styles.empty}>لم نجد هذا الحي. تحقق من كتابة اسمه أو فعّل تحديد الموقع.</Text> : null}
                </ScrollView>
              </View>
            ) : <Text style={styles.empty}>اختر المدينة أولًا.</Text>}
            <View style={styles.privacy}>
              <ShieldCheck size={18} color="#047857" />
              <Text style={styles.privacyText}>يظهر للآخرين اسم المدينة والحي فقط. لا تستخدم عنوان المنزل أو موقعًا دقيقًا داخل وصف المنشور.</Text>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={!canSave || saving} onPress={() => void save()} style={[styles.saveButton, (!canSave || saving) && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Check size={19} color="#FFFFFF" />}
              <Text style={styles.saveText}>{saving ? 'جارٍ الحفظ…' : 'حفظ منطقة النشر'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,20,16,0.55)' },
  outside: { flex: 1 },
  sheet: { backgroundColor: '#FAFCF8', width: '100%', maxHeight: '89%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 15, overflow: 'hidden' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 15 },
  close: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EBF2EC' },
  headerText: { flex: 1, alignItems: 'flex-end' },
  heading: { fontSize: 18, fontWeight: '800', color: '#064E3B', textAlign: 'right' },
  subheading: { fontSize: 11.5, color: '#647C6B', textAlign: 'right', marginTop: 3 },
  headerIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#E0F5E8', alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 18, paddingTop: 2, paddingBottom: 35 },
  gps: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16, borderColor: '#C1E7D1', borderWidth: 1, backgroundColor: '#ECF9F1', marginBottom: 18 },
  gpsTitle: { fontSize: 13.5, color: '#086649', fontWeight: '700', textAlign: 'right' },
  gpsDescription: { fontSize: 11, color: '#617A6B', textAlign: 'right', lineHeight: 18, marginTop: 4 },
  label: { textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#234737', marginBottom: 8 },
  field: { minHeight: 48, borderRadius: 12, borderColor: '#DDE8DF', borderWidth: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { fontSize: 14, color: '#163D2D', fontWeight: '700' },
  lockHint: { textAlign: 'right', color: '#607D70', fontSize: 11.5, marginTop: 7, lineHeight: 19 },
  optionsBox: { borderWidth: 1, borderColor: '#E0E9E1', borderRadius: 14, backgroundColor: '#FFFFFF', marginTop: 7, maxHeight: 292, overflow: 'hidden' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 13, minHeight: 44, borderBottomWidth: 1, borderColor: '#E5EDE7', gap: 8 },
  searchInput: { flex: 1, minHeight: 42, fontSize: 14, color: '#193E2D' },
  selectedLocation: { backgroundColor: '#F3F8F4', paddingHorizontal: 13, paddingVertical: 8 },
  selectedText: { textAlign: 'right', fontSize: 11, color: '#2D6C51' },
  option: { minHeight: 43, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F0F4F1' },
  optionSelected: { backgroundColor: '#ECF8F0' },
  optionText: { textAlign: 'right', color: '#284A37', fontSize: 13.5, fontWeight: '600' },
  optionRegion: { color: '#819386', fontWeight: '400', fontSize: 10 },
  empty: { textAlign: 'right', fontSize: 12, color: '#7D9083', padding: 14 },
  privacy: { marginTop: 16, backgroundColor: '#EDF8F0', borderRadius: 14, padding: 12, flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
  privacyText: { flex: 1, color: '#37634D', lineHeight: 20, textAlign: 'right', fontSize: 11.5 },
  error: { textAlign: 'right', color: '#B42318', fontSize: 12.5, lineHeight: 20, marginTop: 14 },
  footer: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E9EFEB', padding: 15 },
  saveButton: { minHeight: 49, borderRadius: 14, backgroundColor: '#047857', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 },
  disabled: { opacity: 0.45 },
  saveText: { fontSize: 15, color: '#FFFFFF', fontWeight: '800' },
});
