import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buildSaudiLocations, normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { filterCitiesByQuery } from '@/lib/cityPickerPresentation';
import { ChevronLeft, MapPin, Search, Building2, X } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';

const ALL_SAUDI_REGIONS = buildSaudiLocations();
const numberFormat = new Intl.NumberFormat('ar-SA');

export default function Cities() {
  const bottomNavInset = useBottomNavInset();
  const { regionName } = useLocalSearchParams<{ regionName: string }>();
  const [search, setSearch] = useState('');

  const region = useMemo(() => {
    return ALL_SAUDI_REGIONS.find(r => r.name === regionName) || ALL_SAUDI_REGIONS[0];
  }, [regionName]);

  const cities = useMemo(
    () => filterCitiesByQuery(region.cities, search, normalizeSaudiLocationName),
    [region, search],
  );
  const countLabel = search.trim()
    ? `عرض ${numberFormat.format(cities.length)} من ${numberFormat.format(region.cities.length)} مدينة`
    : `تضم المنطقة ${numberFormat.format(region.cities.length)} مدينة ومحافظة`;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title={region.name}
        subtitle="مدن ومحافظات المنطقة"
        fallbackRoute="/locations"
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageContent}>
          <View style={styles.searchSection}>
            <View style={[styles.searchBar, { borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface }]}>
              {search.length > 0 ? (
                <Pressable
                  oasisKind="icon"
                  style={styles.clearSearch}
                  onPress={() => setSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="مسح البحث"
                  accessibilityHint="عرض جميع مدن المنطقة"
                >
                  <X size={18} color={OASIS.colors.muted} />
                </Pressable>
              ) : null}
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن مدينة أو محافظة..."
                placeholderTextColor={OASIS.colors.muted}
                returnKeyType="search"
                blurOnSubmit
                autoCorrect={false}
                accessibilityLabel="البحث عن مدينة أو محافظة"
              />
              <Search size={20} color={OASIS.colors.primary} />
            </View>
          </View>

          <View style={[styles.regionSummary, { backgroundColor: OASIS.colors.soft, borderColor: OASIS.colors.line }]}>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>اختر المدينة للانتقال إلى الأحياء</Text>
              <Text style={styles.summaryCount}>{countLabel}</Text>
            </View>
            <View style={styles.summaryIcon}>
              <MapPin size={20} color={OASIS.colors.primary} />
            </View>
          </View>

          {cities.length > 0 ? (
            <View style={styles.content}>
              {cities.map(city => (
                <Pressable
                  oasisKind="card"
                  key={city.id || city.name}
                  testID={`city-card-${city.id || city.name}`}
                  style={styles.cityCard}
                  accessibilityRole="button"
                  accessibilityLabel={`مدينة ${city.name}، ${numberFormat.format(city.districts.length)} حي مسجل`}
                  accessibilityHint="اضغط لعرض أحياء المدينة"
                  onPress={() =>
                    router.push({
                      pathname: '/districts',
                      params: { regionName: region.name, cityName: city.name },
                    })
                  }
                >
                  <ChevronLeft size={19} color={OASIS.colors.muted} />
                  <View style={styles.cityCopy}>
                    <Text style={styles.cityTitle} numberOfLines={1}>{city.name}</Text>
                    <Text style={styles.citySub}>{numberFormat.format(city.districts.length)} حي سكني مسجّل</Text>
                  </View>
                  <View style={styles.cityIconBox}>
                    <Building2 size={20} color={OASIS.colors.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: OASIS.colors.surface, borderColor: OASIS.colors.line }]}>
              <View style={styles.emptyIcon}>
                <Search size={23} color={OASIS.colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>لم نعثر على مدينة بهذا الاسم</Text>
              <Text style={styles.emptyCopy}>جرّب كتابة اسم أقصر أو تحقق من الإملاء.</Text>
              <Pressable
                oasisKind="action"
                oasisVariant="primary"
                style={styles.resetSearchButton}
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel="مسح البحث والعودة لجميع المدن"
              >
                <Text style={styles.resetSearchText}>عرض جميع المدن</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OASIS.colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  pageContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    color: OASIS.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'right',
  },
  clearSearch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionSummary: {
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 3,
  },
  summaryTitle: {
    color: OASIS.colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },
  summaryCount: {
    color: OASIS.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  cityCard: {
    minHeight: 76,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 5,
    elevation: 1,
    gap: 12,
  },
  cityCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 3,
  },
  cityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'right',
  },
  citySub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  emptyState: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCopy: {
    color: OASIS.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  resetSearchButton: {
    minHeight: 44,
    marginTop: 4,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  resetSearchText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
