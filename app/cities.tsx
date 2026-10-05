import { useBottomNavInset } from '@/lib/bottomNav';
import { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SAUDI_REGIONS } from '@/lib/saudiLocations';
import { ChevronRight, MapPin, Search, ChevronLeft, Building2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';

export default function Cities() {
  const bottomNavInset = useBottomNavInset();
  const { regionName } = useLocalSearchParams<{ regionName: string }>();
  const [search, setSearch] = useState('');

  const region = useMemo(() => {
    return SAUDI_REGIONS.find(r => r.name === regionName) || SAUDI_REGIONS[0];
  }, [regionName]);

  const cities = useMemo(() => {
    return region.cities.filter(c => c.name.includes(search.trim()));
  }, [region, search]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset }]} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ScreenHeader title={region.name} fallbackRoute="/locations" />
          <Text style={styles.heroSub}>
            اختر مدينتك لتصفح الأحياء وربط حسابك بمجتمع الحي.
          </Text>

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث عن مدينة أو محافظة..."
              placeholderTextColor="#94a3b8"
            />
            <Search size={20} color="#059669" />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {cities.map(c => (
            <Pressable
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
                <Building2 size={20} color="#059669" />
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
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 20,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
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
    fontSize: 20,
    fontWeight: '900',
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
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
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
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  cityIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  citySub: {
    color: '#64748b',
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
