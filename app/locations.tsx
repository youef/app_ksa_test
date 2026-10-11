import { useState, useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { buildSaudiLocations, normalizeSaudiLocationName } from '@/lib/saudiLocations';
import {
  MapPin,
  Search,
  ChevronLeft,
  Crosshair,
  Check,
  Building2,
  Globe,
  X,
  Lock,
  Eye,
} from 'lucide-react-native';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  getActiveLocation,
  savePermanentMyLocation,
  getLockedCity,
  isAllKingdom,
  type HaynaLocation,
  type LockedCity,
} from '@/lib/locationSync';
import {
  getCurrentDeviceLocation,
  reverseGeocodeDeviceLocation,
} from '@/lib/deviceLocation';

const ALL_SAUDI_REGIONS = buildSaudiLocations();

export default function Locations() {
  const bottomNavInset = useBottomNavInset();
  const [currentLoc, setCurrentLoc] = useState<HaynaLocation>({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });
  const [locked, setLocked] = useState<LockedCity | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [applyingDistrict, setApplyingDistrict] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [loc, lock] = await Promise.all([getActiveLocation(), getLockedCity()]);
      setCurrentLoc(loc);
      setLocked(lock);
    })();
  }, []);

  const hasLock = Boolean(locked && locked.city && !isAllKingdom(locked.city));

  // Districts of the GPS-locked city only.
  const lockedDistricts = useMemo(() => {
    if (!locked) return [] as string[];
    const target = normalizeSaudiLocationName(locked.city);
    for (const reg of ALL_SAUDI_REGIONS) {
      const city = reg.cities.find(item => normalizeSaudiLocationName(item.name) === target);
      if (city) return city.districts.map(d => d.name);
    }
    return [];
  }, [locked]);

  const filteredDistricts = useMemo(() => {
    if (!districtSearch.trim()) return lockedDistricts;
    const q = normalizeSaudiLocationName(districtSearch);
    return lockedDistricts.filter(d => normalizeSaudiLocationName(d).includes(q));
  }, [lockedDistricts, districtSearch]);

  // Mandatory GPS detection. This is the ONLY way to set/refresh the city.
  const handleAutoDetectGPS = async () => {
    setDetectingGps(true);
    try {
      const devLoc = await getCurrentDeviceLocation();
      if (!devLoc) {
        Alert.alert(
          'إذن الموقع مطلوب',
          'لا يمكن تثبيت مدينتك بدون إذن الموقع. اسمح للتطبيق أو المتصفح بالوصول إلى موقعك ثم أعد المحاولة.',
        );
        return;
      }

      const geo = await reverseGeocodeDeviceLocation(devLoc);
      if (!geo) {
        Alert.alert('تعذّر تحديد الموقع', 'لم نستطع قراءة اسم المدينة من موقعك. أعد المحاولة وتأكد من تفعيل خدمة الموقع.');
        return;
      }

      const normalizedRegion = normalizeSaudiLocationName(geo.region || '');
      const region = normalizedRegion
        ? ALL_SAUDI_REGIONS.find(item => {
            const name = normalizeSaudiLocationName(item.name);
            return name === normalizedRegion || name.includes(normalizedRegion) || normalizedRegion.includes(name);
          })
        : undefined;

      const normalizedCity = normalizeSaudiLocationName(geo.city || '');
      let cityMatch = normalizedCity
        ? region?.cities.find(item => {
            const name = normalizeSaudiLocationName(item.name);
            return name === normalizedCity || name.includes(normalizedCity) || normalizedCity.includes(name);
          })
        : undefined;
      let cityRegion = region;
      if (!cityMatch && normalizedCity) {
        for (const candidateRegion of ALL_SAUDI_REGIONS) {
          const found = candidateRegion.cities.find(item => {
            const name = normalizeSaudiLocationName(item.name);
            return name === normalizedCity || name.includes(normalizedCity) || normalizedCity.includes(name);
          });
          if (found) {
            cityMatch = found;
            cityRegion = candidateRegion;
            break;
          }
        }
      }

      if (!cityMatch || !cityRegion) {
        Alert.alert(
          'لم يتم التعرف على المدينة',
          'تم الحصول على إحداثيات موقعك، لكن اسم المدينة لم يطابق بيانات المدن السعودية. أعد المحاولة من مكان يسمح بتحديد أدق.',
        );
        return;
      }

      const normalizedDistrict = normalizeSaudiLocationName(geo.district || '');
      const districtMatch = cityMatch.districts.find(item => {
        const name = normalizeSaudiLocationName(item.name);
        return normalizedDistrict && (name === normalizedDistrict || name.includes(normalizedDistrict) || normalizedDistrict.includes(name));
      });
      const targetRegion = cityRegion.name;
      const targetCity = cityMatch.name;
      const targetDistrict = districtMatch?.name || 'كل الأحياء';

      await savePermanentMyLocation(
        { region: targetRegion, city: targetCity, district: targetDistrict },
        true,
        { allowCityChange: true },
      );
      const nextLoc: HaynaLocation = { region: targetRegion, city: targetCity, district: targetDistrict };
      setCurrentLoc(nextLoc);
      setLocked({ region: targetRegion, city: targetCity });
      setDistrictSearch('');

      Alert.alert(
        'تم تثبيت مدينتك عبر GPS 📍',
        `تم ضبط موقعك على: مدينة ${targetCity}${targetDistrict !== 'كل الأحياء' ? ` · حي ${targetDistrict}` : ''}.\n\nمدينتك الآن مُقفلة ولا يمكن تغييرها يدوياً، ويمكنك اختيار أي حي بداخلها.`,
        [{ text: 'حسناً' }],
      );
    } catch {
      Alert.alert('خطأ', 'تعذّر جلب الموقع تلقائياً. تأكد من تفعيل خدمة الموقع ثم حاول مجدداً.');
    } finally {
      setDetectingGps(false);
    }
  };

  // Inside the locked city the user may only choose a district (or all of them).
  const handlePickDistrict = async (district: string) => {
    if (!locked) return;
    setApplyingDistrict(true);
    try {
      await savePermanentMyLocation({ region: locked.region, city: locked.city, district }, true);
      setCurrentLoc({ region: locked.region, city: locked.city, district });
      Alert.alert(
        'تم تحديث حيّك 🏡',
        district === 'كل الأحياء'
          ? `تتصفح الآن كل أحياء ${locked.city}.`
          : `تتصفح الآن: ${locked.city} · حي ${district}.`,
        [{ text: 'تم' }],
      );
    } catch (e: any) {
      Alert.alert('تعذّر الحفظ', e?.message || 'حاول مرة أخرى.');
    } finally {
      setApplyingDistrict(false);
    }
  };

  const isAllDistricts = currentLoc.district === 'كل الأحياء' || currentLoc.district === 'كل أحياء المدينة';

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <View style={styles.navInner}>
          <Pressable onPress={() => router.back()} style={styles.navBackBtn} hitSlop={8}>
            <ChevronLeft size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.navTitle}>موقعك المُوثَّق عبر GPS 📍</Text>
          <View style={{ width: 38 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* 1. CURRENT ACTIVE LOCATION CARD */}
          <View style={styles.currentLocCard}>
            <View style={[styles.currentLocIconBox, hasLock && { backgroundColor: '#fef3c7' }]}>
              {hasLock ? <Lock size={20} color="#b45309" /> : <MapPin size={22} color="#059669" />}
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.currentLocLabel}>موقعك الحالي للتصفح</Text>
              <Text style={styles.currentLocValue}>
                {hasLock
                  ? `📍 ${currentLoc.city}${!isAllDistricts ? ` · حي ${currentLoc.district}` : ' · كل الأحياء'}`
                  : 'لم يتم تثبيت مدينتك بعد'}
              </Text>
            </View>
          </View>

          {/* 2. MANDATORY GPS BUTTON */}
          <View style={styles.mandatoryCard}>
            <View style={styles.mandatoryHeader}>
              <Crosshair size={17} color="#b91c1c" />
              <Text style={styles.mandatoryTitle}>تحديد موقعك الحقيقي إلزامي</Text>
            </View>
            <Text style={styles.mandatoryText}>
              نقرأ موقعك الفعلي عبر GPS لتثبيت مدينتك تلقائياً. لا يمكن تغيير المدينة يدوياً لاحقاً، وهذا يضمن
              وصول منشورات وتنبيهات جيرانك الحقيقيين إليك بدقة.
            </Text>
            <Pressable
              style={[styles.gpsBtn, detectingGps && { opacity: 0.6 }]}
              onPress={handleAutoDetectGPS}
              disabled={detectingGps}
              accessibilityRole="button"
            >
              {detectingGps ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Crosshair size={18} color="#fff" />
                  <Text style={styles.gpsBtnText}>
                    {hasLock ? 'تحديث موقعي الحقيقي عبر GPS' : 'تثبيت موقعي عبر GPS الآن'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* 3. DISTRICT PICKER INSIDE THE LOCKED CITY */}
          {hasLock && (
            <>
              <View style={styles.sectionHeader}>
                <Building2 size={18} color="#0284c7" />
                <Text style={styles.sectionTitle}>تصفّح داخل مدينة {locked?.city}</Text>
              </View>

              <Pressable
                style={[styles.allDistrictsRow, isAllDistricts && styles.allDistrictsRowActive]}
                onPress={() => handlePickDistrict('كل الأحياء')}
                disabled={applyingDistrict}
                accessibilityRole="button"
              >
                <Globe size={18} color="#059669" />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.allDistrictsTitle}>كل أحياء {locked?.city} 🏙️</Text>
                  <Text style={styles.allDistrictsSub}>عرض شامل لكافة المنشورات والخدمات في مدينتك</Text>
                </View>
                {isAllDistricts && <Check size={18} color="#059669" />}
              </Pressable>

              {lockedDistricts.length > 0 && (
                <>
                  <View style={styles.searchBar}>
                    <Search size={18} color="#94a3b8" />
                    <TextInput
                      style={styles.searchInput}
                      value={districtSearch}
                      onChangeText={setDistrictSearch}
                      placeholder={`ابحث في أحياء ${locked?.city}...`}
                      placeholderTextColor="#94a3b8"
                      textAlign="right"
                    />
                    {Boolean(districtSearch) && (
                      <Pressable onPress={() => setDistrictSearch('')} hitSlop={8}>
                        <X size={16} color="#94a3b8" />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.districtsList}>
                    {filteredDistricts.map(dName => {
                      const isSelected = currentLoc.city === locked?.city && currentLoc.district === dName;
                      return (
                        <Pressable
                          key={dName}
                          style={[styles.districtRow, isSelected && styles.districtRowActive]}
                          onPress={() => handlePickDistrict(dName)}
                          disabled={applyingDistrict}
                          accessibilityRole="button"
                        >
                          {isSelected ? <Check size={16} color="#059669" /> : <ChevronLeft size={16} color="#94a3b8" />}
                          <Text style={[styles.districtName, isSelected && styles.districtNameActive]}>
                            حي {dName}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {filteredDistricts.length === 0 && (
                      <Text style={styles.noDistrictsText}>لا توجد نتائج مطابقة لاسم هذا الحي داخل مدينتك.</Text>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {/* 4. BROWSE OTHER CITIES (READ-ONLY) */}
          <View style={[styles.sectionHeader, { marginTop: 14 }]}>
            <Eye size={18} color="#64748b" />
            <Text style={styles.sectionTitle}>تصفّح باقي مناطق ومدن المملكة (عرض فقط)</Text>
          </View>
          <Text style={styles.browseHint}>
            يمكنك استعراض محتوى باقي المدن للتعرّف عليه، لكن لا يمكن تفعيلها أو الانتقال إليها — موقعك يبقى مثبتاً على
            مدينتك.
          </Text>

          <View style={styles.regionsList}>
            {ALL_SAUDI_REGIONS.map(r => {
              const isCurrentRegion = hasLock && currentLoc.region === r.name;
              return (
                <Pressable
                  key={r.name}
                  style={[styles.regionCard, isCurrentRegion && styles.regionCardActive]}
                  onPress={() => router.push({ pathname: '/cities', params: { regionName: r.name } })}
                >
                  <ChevronLeft size={16} color="#94a3b8" />
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.regionTitle}>{r.name}</Text>
                    <Text style={styles.regionSub}>
                      {r.cities.length} مدينة ومحافظة · {r.cities.reduce((total, city) => total + city.districts.length, 0)} حي
                    </Text>
                  </View>
                  <View style={[styles.regionIconBox, isCurrentRegion && { backgroundColor: '#ecfdf5' }]}>
                    {isCurrentRegion ? <MapPin size={18} color="#059669" /> : <Eye size={18} color="#94a3b8" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Navbar
  navbar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },

  // Body Content
  scroll: { paddingTop: 14 },
  contentWrap: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },

  // Current Location Card
  currentLocCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  currentLocIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocLabel: { fontSize: 11.5, color: '#64748b', fontWeight: '700' },
  currentLocValue: { fontSize: 16, fontWeight: '900', color: '#0f172a' },

  // Mandatory GPS card
  mandatoryCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    padding: 16,
    gap: 10,
  },
  mandatoryHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  mandatoryTitle: { fontSize: 14.5, fontWeight: '900', color: '#b91c1c' },
  mandatoryText: { fontSize: 12.5, lineHeight: 20, color: '#475569', textAlign: 'right' },
  gpsBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  gpsBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '900' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'right' },
  browseHint: { fontSize: 11.5, lineHeight: 18, color: '#94a3b8', textAlign: 'right', marginTop: -4 },

  // All districts row
  allDistrictsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
  },
  allDistrictsRowActive: { borderColor: '#059669', borderWidth: 1.5 },
  allDistrictsTitle: { fontSize: 14, fontWeight: '900', color: '#047857' },
  allDistrictsSub: { fontSize: 11, color: '#059669', marginTop: 1 },

  // Search
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13.5,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  // Districts
  districtsList: { gap: 6 },
  districtRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  districtRowActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  districtName: { fontSize: 13.5, fontWeight: '800', color: '#0f172a', flex: 1, textAlign: 'right' },
  districtNameActive: { color: '#059669', fontWeight: '900' },
  noDistrictsText: { textAlign: 'center', color: '#94a3b8', fontSize: 12.5, paddingVertical: 16 },

  // Regions list
  regionsList: { gap: 8 },
  regionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  regionCardActive: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  regionTitle: { fontSize: 14.5, fontWeight: '900', color: '#0f172a' },
  regionSub: { fontSize: 11.5, color: '#64748b', marginTop: 1 },
  regionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
