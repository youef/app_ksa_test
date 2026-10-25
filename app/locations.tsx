import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Platform, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { buildSaudiLocations, normalizeSaudiLocationName, isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';
import { AppHeader } from '@/components/shared/AppHeader';
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

  const hasLock = Boolean(locked && locked.city && !isAllKingdom(locked.city) && isKnownSaudiCity(locked.city));

  // Districts of the GPS-locked city only.
  const lockedDistricts = useMemo(() => {
    if (!locked || !isKnownSaudiCity(locked.city)) return [] as string[];
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

      if (!isInsideSaudiArabia(devLoc.latitude, devLoc.longitude)) {
        Alert.alert(
          'الموقع خارج المملكة 🇸🇦',
          'إحداثيات جهازك الحالية تقع خارج المملكة العربية السعودية. التطبيق مخصص لمدن وأحياء المملكة.',
        );
        return;
      }

      const geo = await reverseGeocodeDeviceLocation(devLoc);
      if (!geo || geo.isOutsideKSA) {
        Alert.alert(
          'الموقع خارج المملكة 🇸🇦',
          'موقع جهازك الحالي خارج المملكة العربية السعودية. يرجى اختيار منطقتك ومدينتك يدوياً.',
        );
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
      <AppHeader
        variant="sub"
        title="موقعك الموثّق"
        subtitle={locked ? `مدينة ${locked.city}` : 'تحديد وتوثيق المدينة والحي'}
        fallbackRoute="/home"
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* 1. CURRENT ACTIVE LOCATION CARD */}
          <OasisSurface oasisSurface="card" style={styles.currentLocCard}>
            <View style={[styles.currentLocIconBox, hasLock && { backgroundColor: '#fef3c7' }]}>
              {hasLock ? <Lock size={20} color="#b45309" /> : <MapPin size={22} color={OASIS.colors.primary} />}
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.currentLocLabel}>موقعك الحالي للتصفح</Text>
              <Text style={styles.currentLocValue}>
                {hasLock
                  ? `📍 ${currentLoc.city}${!isAllDistricts ? ` · حي ${currentLoc.district}` : ' · كل الأحياء'}`
                  : 'لم يتم تثبيت مدينتك بعد'}
              </Text>
            </View>
          </OasisSurface>

          {/* 2. MANDATORY GPS BUTTON */}
          <OasisSurface oasisSurface="card" style={styles.mandatoryCard}>
            <View style={styles.mandatoryHeader}>
              <Crosshair size={17} color={OASIS.colors.danger} />
              <Text style={styles.mandatoryTitle}>تحديد موقعك الحقيقي إلزامي</Text>
            </View>
            <Text style={styles.mandatoryText}>
              نقرأ موقعك الفعلي عبر GPS لتثبيت مدينتك تلقائياً. لا يمكن تغيير المدينة يدوياً لاحقاً، وهذا يضمن
              وصول منشورات وتنبيهات جيرانك الحقيقيين إليك بدقة.
            </Text>
            <Pressable oasisKind="action"
              style={[styles.gpsBtn, detectingGps && { opacity: 0.6 }]}
              onPress={handleAutoDetectGPS}
              disabled={detectingGps}
              accessibilityRole="button"
            >
              {detectingGps ? (
                <ActivityIndicator size="small" color={OASIS.colors.surface} />
              ) : (
                <>
                  <Crosshair size={18} color={OASIS.colors.surface} />
                  <Text style={styles.gpsBtnText}>
                    {hasLock ? 'تحديث موقعي الحقيقي عبر GPS' : 'تثبيت موقعي عبر GPS الآن'}
                  </Text>
                </>
              )}
            </Pressable>
          </OasisSurface>

          {/* 3. DISTRICT PICKER INSIDE THE LOCKED CITY */}
          {hasLock && (
            <>
              <View style={styles.sectionHeader}>
                <Building2 size={18} color={OASIS.colors.info} />
                <Text style={styles.sectionTitle}>تصفّح داخل مدينة {locked?.city}</Text>
              </View>

              <Pressable
                style={[styles.allDistrictsRow, isAllDistricts && styles.allDistrictsRowActive]}
                onPress={() => handlePickDistrict('كل الأحياء')}
                disabled={applyingDistrict}
                accessibilityRole="button"
              >
                <Globe size={18} color={OASIS.colors.primary} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.allDistrictsTitle}>كل أحياء {locked?.city} 🏙️</Text>
                  <Text style={styles.allDistrictsSub}>عرض شامل لكافة المنشورات والخدمات في مدينتك</Text>
                </View>
                {isAllDistricts && <Check size={18} color={OASIS.colors.primary} />}
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
                          {isSelected ? <Check size={16} color={OASIS.colors.primary} /> : <ChevronLeft size={16} color="#94a3b8" />}
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
            <Eye size={18} color={OASIS.colors.muted} />
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
                <Pressable oasisKind="card"
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
                  <View style={[styles.regionIconBox, isCurrentRegion && { backgroundColor: OASIS.colors.soft }]}>
                    {isCurrentRegion ? <MapPin size={18} color={OASIS.colors.primary} /> : <Eye size={18} color="#94a3b8" />}
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
  container: { flex: 1, backgroundColor: OASIS.colors.background },

  // Navbar
  navbar: {
    backgroundColor: OASIS.colors.surface,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
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
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 2,
  },
  currentLocIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocLabel: { fontSize: 11.5, color: OASIS.colors.muted, fontWeight: '700' },
  currentLocValue: { fontSize: 16, fontWeight: '700', color: OASIS.colors.ink },

  // Mandatory GPS card
  mandatoryCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    padding: 14,
    gap: 10,
  },
  mandatoryHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  mandatoryTitle: { fontSize: 14.5, fontWeight: '700', color: OASIS.colors.danger },
  mandatoryText: { fontSize: 12.5, lineHeight: 20, color: OASIS.colors.muted, textAlign: 'right' },
  gpsBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: OASIS.colors.primary,
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 3,
  },
  gpsBtnText: { color: OASIS.colors.surface, fontSize: 13.5, fontWeight: '700' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink, flex: 1, textAlign: 'right' },
  browseHint: { fontSize: 11.5, lineHeight: 18, color: '#94a3b8', textAlign: 'right', marginTop: -4 },

  // All districts row
  allDistrictsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
  },
  allDistrictsRowActive: { borderColor: OASIS.colors.primary, borderWidth: 1.5 },
  allDistrictsTitle: { fontSize: 14, fontWeight: '700', color: OASIS.colors.primary },
  allDistrictsSub: { fontSize: 11, color: OASIS.colors.primary, marginTop: 1 },

  // Search
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  searchInput: {
    flex: 1,
    color: OASIS.colors.ink,
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
    backgroundColor: OASIS.colors.surface,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  districtRowActive: {
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  districtName: { fontSize: 13.5, fontWeight: '600', color: OASIS.colors.ink, flex: 1, textAlign: 'right' },
  districtNameActive: { color: OASIS.colors.primary, fontWeight: '700' },
  noDistrictsText: { textAlign: 'center', color: '#94a3b8', fontSize: 12.5, paddingVertical: 16 },

  // Regions list
  regionsList: { gap: 8 },
  regionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  regionCardActive: {
    borderColor: OASIS.colors.primary,
    backgroundColor: OASIS.colors.soft,
  },
  regionTitle: { fontSize: 14.5, fontWeight: '700', color: OASIS.colors.ink },
  regionSub: { fontSize: 11.5, color: OASIS.colors.muted, marginTop: 1 },
  regionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
