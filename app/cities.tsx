import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buildSaudiLocations } from '@/lib/saudiLocations';
import { ChevronRight, MapPin, Search, ChevronLeft, Building2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/shared/AppHeader';

const ALL_SAUDI_REGIONS = buildSaudiLocations();

export default function Cities() {
  const bottomNavInset = useBottomNavInset();
  const { regionName } = useLocalSearchParams<{ regionName: string }>();
  const [search, setSearch] = useState('');

  const region = useMemo(() => {
    return ALL_SAUDI_REGIONS.find(r => r.name === regionName) || ALL_SAUDI_REGIONS[0];
  }, [regionName]);

  const cities = useMemo(() => {
    return region.cities.filter(c => c.name.includes(search.trim()));
  }, [region, search]);

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="sub"
        title={region.name}
        subtitle="مدن ومحافظات المنطقة"
        fallbackRoute="/locations"
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset }]} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
          <View style={[styles.searchBar, { borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface }]}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث عن مدينة أو محافظة..."
              placeholderTextColor="#94a3b8"
            />
            <Search size={20} color={OASIS.colors.primary} />
          </View>
        </View>

        <View style={styles.content}>
          {cities.map(c => (
            <Pressable oasisKind="card"
              key={c.name}
              style={styles.cityCard}
              onPress={() =>
                router.push({
                  pathname: '/districts',
                  params: { regionName: region.name, cityName: c.name },
                })
              }
            >
              <ChevronLeft size={18} color="#94a3b8" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.cityTitle}>{c.name}</Text>
                <Text style={styles.citySub}>{c.districts.length} حي سكني مسجّل</Text>
              </View>
              <View style={styles.cityIconBox}>
                <Building2 size={20} color={OASIS.colors.primary} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 100 }} />
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
    paddingBottom: 14,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    color: OASIS.colors.surface,
    fontSize: 20,
    fontWeight: '700',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: OASIS.colors.ink,
    fontSize: 13,
    textAlign: 'right',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  cityCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  cityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityTitle: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  citySub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
