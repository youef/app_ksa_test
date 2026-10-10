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
  Modal,
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
  Sparkles,
  Globe,
  X,
  Compass,
  ArrowRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  getActiveLocation,
  savePermanentMyLocation,
  isAllKingdom,
  type HaynaLocation,
} from '@/lib/locationSync';
import {
  getCurrentDeviceLocation,
  reverseGeocodeDeviceLocation,
} from '@/lib/deviceLocation';

const ALL_SAUDI_REGIONS = buildSaudiLocations();

export default function Locations() {
  const bottomNavInset = useBottomNavInset();
  const [search, setSearch] = useState('');
  const [currentLoc, setCurrentLoc] = useState<HaynaLocation>({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });
  const [detectingGps, setDetectingGps] = useState(false);

  // Selected city for picking a district
  const [selectedCityObj, setSelectedCityObj] = useState<{ city: string; region: string; districts: string[] } | null>(null);
  const [districtSearch, setDistrictSearch] = useState('');

  useEffect(() => {
    getActiveLocation().then(setCurrentLoc);
  }, []);

  // Handle GPS location auto-detect
  const handleAutoDetectGPS = async () => {
    setDetectingGps(true);
    try {
      const devLoc = await getCurrentDeviceLocation();
      if (!devLoc) {
        Alert.alert('تنبيه الموقع', 'يرجى السماح بالوصول للموقع لتحديد حيك تلقائياً.');
        setDetectingGps(false);
        return;
      }

      const geo = await reverseGeocodeDeviceLocation(devLoc);
      if (!geo) {
        Alert.alert('تعذر تحديد الموقع', 'لم نستطع قراءة اسم المدينة من موقعك. ابحث عن مدينتك يدويًا أو أعد المحاولة.');
        return;
      }

      const normalizedRegion = normalizeSaudiLocationName(geo.region || '');
      const region = ALL_SAUDI_REGIONS.find((item) => {
        const name = normalizeSaudiLocationName(item.name);
        return name === normalizedRegion || name.includes(normalizedRegion) || normalizedRegion.includes(name);
      });

      const normalizedCity = normalizeSaudiLocationName(geo.city || '');
      let cityMatch = region?.cities.find((item) => {
        const name = normalizeSaudiLocationName(item.name);
        return name === normalizedCity || name.includes(normalizedCity) || normalizedCity.includes(name);
      });
      let cityRegion = region;
      if (!cityMatch && normalizedCity) {
        for (const candidateRegion of ALL_SAUDI_REGIONS) {
          const found = candidateRegion.cities.find((item) => {
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
          'تم الحصول على إحداثيات موقعك، لكن اسم المدينة لم يطابق بيانات المدن السعودية. ابحث عن المدينة يدويًا بدل اختيار مدينة غير صحيحة.'
        );
        return;
      }

      const normalizedDistrict = normalizeSaudiLocationName(geo.district || '');
      const districtMatch = cityMatch.districts.find((item) => {
        const name = normalizeSaudiLocationName(item.name);
        return normalizedDistrict && (name === normalizedDistrict || name.includes(normalizedDistrict) || normalizedDistrict.includes(name));
      });
      const targetRegion = cityRegion.name;
      const targetCity = cityMatch.name;
      const targetDistrict = districtMatch?.name || 'كل الأحياء';

      await savePermanentMyLocation({ region: targetRegion, city: targetCity, district: targetDistrict });
      setCurrentLoc({ region: targetRegion, city: targetCity, district: targetDistrict });

      Alert.alert(
        'تم تحديد موقعك بنجاح! 📍',
        `تم ضبط الموقع على: مدينة ${targetCity}${targetDistrict !== 'كل الأحياء' ? ` · حي ${targetDistrict}` : ''}.`,
        [{ text: 'حسناً', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('خطأ', 'تعذر جلب الموقع تلقائياً. يمكنك اختيار مدينتك يدوياً.');
    } finally {
      setDetectingGps(false);
    }
  };

  // Set All Kingdom (Nationwide)
  const handleSetAllKingdom = async () => {
    const loc: HaynaLocation = {
      region: 'كل المملكة',
      city: 'كل المدن',
      district: 'كل الأحياء',
    };
    await savePermanentMyLocation(loc);
    setCurrentLoc(loc);
    Alert.alert('تم التحديث 🇸🇦', 'أنت الآن تتصفح جميع مدن ومناطق المملكة.', [
      { text: 'حسناً', onPress: () => router.back() },
    ]);
  };

  // Select a City and open district picker
  const handleOpenCity = (cityName: string, regionName: string) => {
    // Find districts for this city from SAUDI_REGIONS database
    let districtsList: string[] = [];
    for (const reg of ALL_SAUDI_REGIONS) {
      const c = reg.cities.find((item) => item.name === cityName);
      if (c && c.districts && c.districts.length > 0) {
        districtsList = c.districts.map((d) => d.name);
        break;
      }
    }

    if (districtsList.length === 0) {
      // Direct apply if no specific districts defined
      void handleApplyLocation(regionName, cityName, 'كل الأحياء');
    } else {
      setSelectedCityObj({
        city: cityName,
        region: regionName,
        districts: districtsList,
      });
      setDistrictSearch('');
    }
  };

  // Apply chosen location
  const handleApplyLocation = async (region: string, city: string, district: string) => {
    const loc: HaynaLocation = {
      region,
      city,
      district,
    };
    await savePermanentMyLocation(loc);
    setCurrentLoc(loc);
    setSelectedCityObj(null);
    Alert.alert('تم ضبط الموقع بنجاح 📍', `تتصفح الآن: ${city}${district && district !== 'كل الأحياء' ? ` · حي ${district}` : ''}.`, [
      { text: 'تم', onPress: () => router.back() },
    ]);
  };

  const query = search.trim();

  // Search results across regions and cities
  const searchResults = useMemo(() => {
    if (!query) return null;
    const q = query.toLowerCase();
    const hits: Array<{ type: 'city' | 'region' | 'district'; name: string; region: string; city?: string }> = [];

    SAUDI_REGIONS.forEach((reg) => {
      if (reg.name.toLowerCase().includes(q)) {
        hits.push({ type: 'region', name: reg.name, region: reg.name });
      }
      reg.cities.forEach((c) => {
        if (c.name.toLowerCase().includes(q)) {
          hits.push({ type: 'city', name: c.name, region: reg.name });
        }
        c.districts.forEach((district) => {
          if (district.name.toLowerCase().includes(q)) {
            hits.push({ type: 'district', name: district.name, region: reg.name, city: c.name });
          }
        });
      });
    });

    return hits.slice(0, 30);
  }, [query]);

  // Filtered districts inside modal
  const filteredDistricts = useMemo(() => {
    if (!selectedCityObj) return [];
    if (!districtSearch.trim()) return selectedCityObj.districts;
    const dq = districtSearch.trim().toLowerCase();
    return selectedCityObj.districts.filter((d) => d.toLowerCase().includes(dq));
  }, [selectedCityObj, districtSearch]);

  const isKingdomActive = isAllKingdom(currentLoc.city);

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <View style={styles.navInner}>
          <Pressable onPress={() => router.back()} style={styles.navBackBtn} hitSlop={8}>
            <ChevronLeft size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.navTitle}>تحديد واختيار الموقع 🇸🇦</Text>
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
            <View style={styles.currentLocIconBox}>
              <MapPin size={22} color="#059669" />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.currentLocLabel}>موقعك المختار حالياً للتصفح</Text>
              <Text style={styles.currentLocValue}>
                {isKingdomActive
                  ? '🇸🇦 كل مناطق ومدن المملكة'
                  : `📍 ${currentLoc.city}${currentLoc.district && currentLoc.district !== 'كل الأحياء' ? ` · حي ${currentLoc.district}` : ''}`}
              </Text>
            </View>
          </View>

          {/* 2. INSTANT ACTION BUTTONS: GPS & ALL KINGDOM */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.gpsBtn, detectingGps && { opacity: 0.6 }]}
              onPress={handleAutoDetectGPS}
              disabled={detectingGps}
            >
              {detectingGps ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Crosshair size={18} color="#fff" />
                  <Text style={styles.gpsBtnText}>موقعي الحالي عبر GPS 📍</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.allKingdomBtn, isKingdomActive && styles.allKingdomBtnActive]}
              onPress={handleSetAllKingdom}
            >
              <Globe size={18} color={isKingdomActive ? '#fff' : '#047857'} />
              <Text style={[styles.allKingdomBtnText, isKingdomActive && { color: '#fff' }]}>
                كل المملكة 🇸🇦
              </Text>
            </Pressable>
          </View>

          {/* 3. SEARCH INPUT */}
          <View style={styles.searchBar}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث عن مدينة، منطقة، أو محافظة..."
              placeholderTextColor="#94a3b8"
              textAlign="right"
            />
            {Boolean(search) && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          {/* 4. SEARCH RESULTS (IF SEARCHING) */}
          {searchResults && searchResults.length > 0 && (
            <View style={styles.searchResultsBox}>
              <Text style={styles.searchResultTitle}>نتائج البحث ({searchResults.length})</Text>
              <View style={{ gap: 6 }}>
                {searchResults.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.searchResultRow}
                    onPress={() => {
                      if (item.type === 'district' && item.city) {
                        void handleApplyLocation(item.region, item.city, item.name);
                      } else if (item.type === 'city') {
                        handleOpenCity(item.name, item.region);
                      } else {
                        router.push({ pathname: '/cities', params: { regionName: item.name } });
                      }
                    }}
                  >
                    <ChevronLeft size={16} color="#94a3b8" />
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.searchResultName}>{item.name}</Text>
                      <Text style={styles.searchResultSub}>
                        {item.type === 'city' ? `مدينة · ${item.region}` : 'منطقة إدارية بالمملكة'}
                      </Text>
                    </View>
                    <View style={styles.searchResultIconBox}>
                      <MapPin size={16} color="#059669" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Browse all cities, municipalities and districts from the full dataset */}
          {/* BROWSE ALL ADMINISTRATIVE REGIONS */}
          <View style={[styles.sectionHeader, { marginTop: 14 }]}>
            <Building2 size={18} color="#0284c7" />
            <Text style={styles.sectionTitle}>جميع مناطق ومدن ومحافظات المملكة</Text>
          </View>

          <View style={styles.regionsList}>
            {ALL_SAUDI_REGIONS.map((r) => {
              const isCurrentRegion = currentLoc.region === r.name;
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
                    <MapPin size={18} color={isCurrentRegion ? '#059669' : '#64748b'} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: DISTRICT / NEIGHBORHOOD SELECTOR SHEET            */}
      {/* ======================================================== */}
      {selectedCityObj && (
        <Modal
          visible={!!selectedCityObj}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedCityObj(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedCityObj(null)} style={styles.modalCloseBtn} hitSlop={8}>
                  <X size={18} color="#0f172a" />
                </Pressable>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.modalTitle}>مدينة {selectedCityObj.city}</Text>
                  <Text style={styles.modalSub}>{selectedCityObj.region} · اختر حيك المفضل</Text>
                </View>
              </View>

              {/* Option 1: All neighborhoods in this city */}
              <Pressable
                style={styles.allDistrictsRow}
                onPress={() => handleApplyLocation(selectedCityObj.region, selectedCityObj.city, 'كل الأحياء')}
              >
                <ArrowRight size={16} color="#059669" />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.allDistrictsTitle}>تصفح كل أحياء {selectedCityObj.city} 🏙️</Text>
                  <Text style={styles.allDistrictsSub}>عرض شامل لكافة العروض والخدمات في المدينة</Text>
                </View>
                <View style={styles.allDistrictsIconBox}>
                  <Building2 size={18} color="#059669" />
                </View>
              </Pressable>

              {/* District Filter Input */}
              <View style={styles.districtSearchBox}>
                <Search size={16} color="#94a3b8" />
                <TextInput
                  style={styles.districtSearchInput}
                  value={districtSearch}
                  onChangeText={setDistrictSearch}
                  placeholder={`ابحث في أحياء ${selectedCityObj.city}...`}
                  placeholderTextColor="#94a3b8"
                  textAlign="right"
                />
              </View>

              {/* Districts List */}
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360, marginTop: 8 }}>
                <View style={{ gap: 6, paddingBottom: 20 }}>
                  {filteredDistricts.map((dName) => {
                    const isSelected = currentLoc.city === selectedCityObj.city && currentLoc.district === dName;
                    return (
                      <Pressable
                        key={dName}
                        style={[styles.districtRow, isSelected && styles.districtRowActive]}
                        onPress={() => handleApplyLocation(selectedCityObj.region, selectedCityObj.city, dName)}
                      >
                        {isSelected ? (
                          <Check size={16} color="#059669" />
                        ) : (
                          <ChevronLeft size={16} color="#94a3b8" />
                        )}
                        <Text style={[styles.districtName, isSelected && styles.districtNameActive]}>
                          حي {dName}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {filteredDistricts.length === 0 && (
                    <Text style={styles.noDistrictsText}>لا توجد نتائج مطابقة لاسم هذا الحي.</Text>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
    fontSize: 17,
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

  // Action Row
  actionRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  gpsBtn: {
    flex: 1.2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  gpsBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  allKingdomBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    paddingVertical: 13,
    borderRadius: 14,
  },
  allKingdomBtnActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  allKingdomBtnText: { color: '#047857', fontSize: 13, fontWeight: '900' },

  // Search Bar
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

  // Search Results Box
  searchResultsBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchResultTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  searchResultRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  searchResultName: { fontSize: 13.5, fontWeight: '800', color: '#0f172a' },
  searchResultSub: { fontSize: 11, color: '#64748b' },
  searchResultIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },

  // Top Cities Grid
  topCitiesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  cityCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-end',
    gap: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cityCardActive: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  activeCheckPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeCheckText: { color: '#fff', fontSize: 9.5, fontWeight: '900' },
  cityName: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  cityNameActive: { color: '#059669' },
  cityDesc: { fontSize: 11, color: '#64748b' },

  // Regions List
  regionsList: {
    gap: 8,
  },
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

  // Modal Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 14,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  modalSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  allDistrictsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  allDistrictsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDistrictsTitle: { fontSize: 14, fontWeight: '900', color: '#047857' },
  allDistrictsSub: { fontSize: 11, color: '#059669', marginTop: 1 },

  districtSearchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  districtSearchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  districtRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  districtRowActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  districtName: { fontSize: 13.5, fontWeight: '800', color: '#0f172a' },
  districtNameActive: { color: '#059669', fontWeight: '900' },
  noDistrictsText: { textAlign: 'center', color: '#94a3b8', fontSize: 12.5, paddingVertical: 16 },
});
