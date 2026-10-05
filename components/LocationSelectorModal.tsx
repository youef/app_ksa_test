import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import {
  SAUDI_REGIONS,
  buildSaudiLocations,
  normalizeSaudiLocationName,
  Region,
  City,
  District,
  CustomLocation,
  LocationOverride,
} from '@/lib/saudiLocations';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  Globe2,
  Compass,
  Building2,
  Sparkles,
} from 'lucide-react-native';
import { C } from '@/lib/ui';
import { resolveShortNationalAddress, NationalAddressResolution } from '@/lib/nationalAddress';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import ActionSheet from '@/components/ActionSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedCity: string;
  selectedDistrict: string;
  onSelect: (region: string, city: string, district: string) => void;
}

export default function LocationSelectorModal({
  visible,
  onClose,
  selectedCity,
  selectedDistrict,
  onSelect,
}: Props) {
  // Step 1: Region -> Step 2: City -> Step 3: District
  const [step, setStep] = useState<'region' | 'city' | 'district'>('region');
  const [selectedReg, setSelectedReg] = useState<Region | null>(null);
  const [selectedCit, setSelectedCit] = useState<City | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<Region[]>(SAUDI_REGIONS);
  const [visibleCount, setVisibleCount] = useState(100);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    Promise.all([
      supabase.from('saudi_custom_locations').select('id,region_name,city_name,district_name,latitude,longitude').limit(5000),
      supabase.from('saudi_location_overrides').select('source_id,new_name,is_deleted'),
    ]).then(([customResult, overrideResult]) => {
      if (!active) return;
      const overrides = (overrideResult.data || []) as LocationOverride[];
      setLocations(buildSaudiLocations((customResult.data || []) as CustomLocation[], overrides));
    });
    return () => { active = false; };
  }, [visible]);

  useEffect(() => { setVisibleCount(100); }, [step, searchQuery]);

  // National Address Short Code state
  const [shortCodeInput, setShortCodeInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<NationalAddressResolution | null>(null);

  function handleShortCodeChange(text: string) {
    setShortCodeInput(text);
    const resolved = resolveShortNationalAddress(text);
    setResolvedAddress(resolved);
  }

  function handleApplyResolvedAddress() {
    if (!resolvedAddress) return;
    onSelect(resolvedAddress.region, resolvedAddress.city, resolvedAddress.district);
    resetAndClose();
  }

  function resetAndClose() {
    setStep('region');
    setSelectedReg(null);
    setSelectedCit(null);
    setSearchQuery('');
    setShortCodeInput('');
    setResolvedAddress(null);
    onClose();
  }

  function handleSelectAllKSA() {
    onSelect('كل المملكة', 'كل المدن', 'كل الأحياء');
    resetAndClose();
  }

  async function handleUseCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        Alert.alert('تعذّر تحديد الموقع', 'اسمح للمتصفح أو التطبيق باستخدام موقعك ثم حاول مرة أخرى.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(location);
      const region = place?.region?.trim() || '';
      const city = place?.city?.trim() || '';
      const district = place?.district?.trim() || '';
      if (!region || !city || !district) {
        Alert.alert('الموقع غير مكتمل', 'لم نتمكن من استخراج المنطقة والمدينة والحي بدقة. اخترها يدوياً من القائمة.');
        return;
      }
      onSelect(region, city, district);
      resetAndClose();
    } catch (error: any) {
      Alert.alert('تعذّر تحديد الموقع', error?.message || 'اختر المنطقة والمدينة والحي يدوياً.');
    } finally {
      setLocating(false);
    }
  }

  function handleChooseRegion(reg: Region) {
    setSelectedReg(reg);
    setStep('city');
    setSearchQuery('');
  }

  function handleChooseCity(cit: City) {
    setSelectedCit(cit);
    setStep('district');
    setSearchQuery('');
  }

  function handleChooseAllCityDistricts() {
    if (!selectedReg || !selectedCit) return;
    onSelect(selectedReg.name, selectedCit.name, 'كل الأحياء');
    resetAndClose();
  }

  function handleChooseDistrict(dist: District) {
    if (!selectedReg || !selectedCit) return;
    onSelect(selectedReg.name, selectedCit.name, dist.name);
    resetAndClose();
  }

  // Filtered lists
  const queryKey = normalizeSaudiLocationName(searchQuery);
  const filteredRegions = locations.filter(r => normalizeSaudiLocationName(r.name).includes(queryKey));

  const filteredCities = (selectedReg?.cities || []).filter(c =>
    normalizeSaudiLocationName(c.name).includes(queryKey)
  );

  const filteredDistricts = (selectedCit?.districts || []).filter(d =>
    normalizeSaudiLocationName(d.name).includes(queryKey)
  );

  return (
    <ActionSheet
      visible={visible}
      onClose={resetAndClose}
      height="85%"
    >
      <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={resetAndClose} style={styles.closeBtn}>
              <X size={22} color="#475569" />
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>
                {step === 'region' && 'اختر المنطقة 🇸🇦'}
                {step === 'city' && `مدن ${selectedReg?.name}`}
                {step === 'district' && `أحياء ${selectedCit?.name}`}
              </Text>
              <Text style={styles.headerSub}>
                {step === 'region' && 'تحديد المحتوى المعروض حسب منطقتك'}
                {step === 'city' && 'اختر المدينة لمشاهدة أسئلة وجيران مدينتك'}
                {step === 'district' && 'اختر حيك بالتحديد أو كل أحياء المدينة'}
              </Text>
            </View>

            {step !== 'region' ? (
              <Pressable
                onPress={() => setStep(step === 'district' ? 'city' : 'region')}
                style={styles.backBtn}
              >
                <ChevronRight size={22} color="#059669" />
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                step === 'region'
                  ? 'ابحث عن منطقة...'
                  : step === 'city'
                  ? 'ابحث عن مدينة...'
                  : 'ابحث عن حي...'
              }
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* List Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1: Regions */}
            {step === 'region' && (
              <>
                <Pressable
                  style={styles.currentLocationButton}
                  onPress={handleUseCurrentLocation}
                  disabled={locating}
                  accessibilityRole="button"
                  accessibilityLabel="تحديد موقعي تلقائياً"
                >
                  {locating ? <ActivityIndicator size="small" color="#fff" /> : <Compass size={18} color="#fff" />}
                  <Text style={styles.currentLocationButtonText}>
                    {locating ? 'جارٍ تحديد موقعك…' : 'تحديد موقعي تلقائياً'}
                  </Text>
                </Pressable>

                {/* National Address Short Code Entry Box */}
                <View style={styles.nationalAddressCard}>
                  <View style={styles.naHeaderRow}>
                    <Sparkles size={16} color="#059669" />
                    <Text style={styles.naHeaderTitle}>تحديد سريع برمز العنوان الوطني</Text>
                  </View>
                  <Text style={styles.naDesc}>
                    اكتب الرمز المختصر لعنوانك (مثال: RRRD2929) للتحديد الدقيق فوراً
                  </Text>
                  <View style={styles.naInputRow}>
                    <Building2 size={18} color="#059669" />
                    <TextInput
                      style={styles.naInput}
                      placeholder="أدخل الرمز مثل RRRD2929..."
                      placeholderTextColor="#94a3b8"
                      value={shortCodeInput}
                      onChangeText={handleShortCodeChange}
                      autoCapitalize="characters"
                      maxLength={10}
                    />
                  </View>

                  {resolvedAddress && (
                    <View style={styles.resolvedBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resolvedLabel}>تم التعرف على العنوان:</Text>
                        <Text style={styles.resolvedValue}>
                          {resolvedAddress.region} · {resolvedAddress.city} · حي {resolvedAddress.district}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.applyResolvedBtn}
                        onPress={handleApplyResolvedAddress}
                      >
                        <Text style={styles.applyResolvedText}>تأكيد واختيار</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                {/* Option for All Saudi Arabia */}
                <Pressable
                  style={[
                    styles.itemCard,
                    selectedCity === 'كل المدن' && styles.itemCardSelected,
                  ]}
                  onPress={handleSelectAllKSA}
                >
                  <View style={styles.itemRadio}>
                    {selectedCity === 'كل المدن' && <Check size={16} color="#059669" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>🇸🇦 كل مناطق المملكة العربية السعودية</Text>
                    <Text style={styles.itemDesc}>عرض كافة المنشورات والأسئلة لجميع المناطق</Text>
                  </View>
                  <Globe2 size={24} color="#059669" />
                </Pressable>

                <View style={styles.divider} />

                {filteredRegions.map(reg => (
                  <Pressable
                    key={reg.id}
                    style={styles.itemCard}
                    onPress={() => handleChooseRegion(reg)}
                  >
                    <ChevronLeft size={20} color="#94a3b8" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{reg.name}</Text>
                      <Text style={styles.itemDesc}>{reg.cities.length} مدن ومحافظات رئيسية</Text>
                    </View>
                    <View style={styles.itemIconWrap}>
                      <MapPin size={18} color="#059669" />
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {/* Step 2: Cities */}
            {step === 'city' && (
              <>
                {filteredCities.slice(0, visibleCount).map(cit => {
                  const isCitySelected = selectedCity === cit.name;
                  return (
                    <Pressable
                      key={cit.id}
                      style={[styles.itemCard, isCitySelected && styles.itemCardSelected]}
                      onPress={() => handleChooseCity(cit)}
                    >
                      <ChevronLeft size={20} color="#94a3b8" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{cit.name}</Text>
                        <Text style={styles.itemDesc}>{cit.districts.length} أحياء مشهورة</Text>
                      </View>
                      <View style={styles.itemIconWrap}>
                        <MapPin size={18} color="#059669" />
                      </View>
                    </Pressable>
                  );
                })}
                {filteredCities.length > visibleCount && <Pressable style={styles.loadMore} onPress={() => setVisibleCount(count => count + 100)}><Text style={styles.loadMoreText}>عرض ١٠٠ مدينة إضافية · المتبقي {filteredCities.length - visibleCount}</Text></Pressable>}
              </>
            )}

            {/* Step 3: Districts */}
            {step === 'district' && (
              <>
                {/* Option for All Districts in this City */}
                <Pressable
                  style={[
                    styles.itemCard,
                    selectedCity === selectedCit?.name && selectedDistrict === 'كل الأحياء' && styles.itemCardSelected,
                  ]}
                  onPress={handleChooseAllCityDistricts}
                >
                  <View style={styles.itemRadio}>
                    {selectedCity === selectedCit?.name && selectedDistrict === 'كل الأحياء' && (
                      <Check size={16} color="#059669" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>كل أحياء {selectedCit?.name}</Text>
                    <Text style={styles.itemDesc}>تصفح كل ما ينشره جيران {selectedCit?.name}</Text>
                  </View>
                </Pressable>

                <View style={styles.divider} />

                {filteredDistricts.slice(0, visibleCount).map(dist => {
                  const isSelected = selectedCity === selectedCit?.name && selectedDistrict === dist.name;
                  return (
                    <Pressable
                      key={dist.id}
                      style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                      onPress={() => handleChooseDistrict(dist)}
                    >
                      <View style={styles.itemRadio}>
                        {isSelected && <Check size={16} color="#059669" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{dist.name}</Text>
                      </View>
                      <View style={styles.itemIconWrap}>
                        <MapPin size={18} color="#059669" />
                      </View>
                    </Pressable>
                  );
                })}
                {filteredDistricts.length > visibleCount && <Pressable style={styles.loadMore} onPress={() => setVisibleCount(count => count + 100)}><Text style={styles.loadMoreText}>عرض ١٠٠ حي إضافي · المتبقي {filteredDistricts.length - visibleCount}</Text></Pressable>}
              </>
            )}
          </ScrollView>
      </View>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    minHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    textAlign: 'right',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6,
  },
  loadMore: { alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#ecfdf5' },
  loadMoreText: { color: '#047857', fontSize: 13, fontWeight: '800' },
  itemCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    gap: 12,
  },
  itemCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  itemDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  currentLocationButton: {
    minHeight: 46,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#059669',
  },
  currentLocationButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  nationalAddressCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 6,
  },
  naHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  naHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'right',
  },
  naDesc: {
    fontSize: 12,
    color: '#065f46',
    textAlign: 'right',
    marginBottom: 10,
  },
  naInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  naInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'right',
  },
  resolvedBox: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 10,
  },
  resolvedLabel: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
  },
  resolvedValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
    marginTop: 2,
  },
  applyResolvedBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  applyResolvedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
