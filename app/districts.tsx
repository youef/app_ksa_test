import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useState, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buildSaudiLocations, normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronRight, MapPin, Search, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/shared/AppHeader';
import { savePermanentMyLocation, getLockedCity } from '@/lib/locationSync';

const ALL_SAUDI_REGIONS = buildSaudiLocations();

export default function Districts() {
  const bottomNavInset = useBottomNavInset();
  const { regionName, cityName } = useLocalSearchParams<{ regionName: string; cityName: string }>();
  const [search, setSearch] = useState('');

  const city = useMemo(() => {
    for (const r of ALL_SAUDI_REGIONS) {
      const found = r.cities.find(c => c.name === cityName);
      if (found) return found;
    }
    return ALL_SAUDI_REGIONS[0].cities[0];
  }, [cityName]);

  const districts = useMemo(() => {
    return city.districts.filter(d => d.name.includes(search.trim()));
  }, [city, search]);

  async function selectDistrict(districtName: string) {
    try {
      // A GPS-verified city cannot be switched from here. Districts of another
      // city are browse-only, so the active location stays locked.
      const lock = await getLockedCity();
      if (lock && normalizeSaudiLocationName(city.name) !== normalizeSaudiLocationName(lock.city)) {
        Alert.alert(
          'هذه المدينة للعرض فقط',
          `موقعك مُثبّت عبر GPS على مدينة ${lock.city}. يمكنك تصفح محتوى ${city.name} دون تفعيله أو الانتقال إليه.`,
          [{ text: 'حسناً' }],
        );
        return;
      }

      // 1. Save permanent location to device immediately (persists even if user logs out!)
      await savePermanentMyLocation({
        region: regionName || 'المملكة',
        city: city.name,
        district: districtName,
      }, true);

      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase
          .from('profiles')
          .update({ city: city.name, district: districtName })
          .eq('id', u.user.id);

        // Update AsyncStorage cache
        const cached = await AsyncStorage.getItem(`@hayna_privacy_settings_${u.user.id}`);
        const parsed = cached ? JSON.parse(cached) : {};
        parsed.city = city.name;
        parsed.district = districtName;
        await AsyncStorage.setItem(`@hayna_privacy_settings_${u.user.id}`, JSON.stringify(parsed));
      }

      Alert.alert(
        'تم تحديد حيك بنجاح! 🏡',
        `تم ربط حسابك بـ ${city.name} · حي ${districtName}. مرحباً بك بين جيرانك!`,
        [
          {
            text: 'الانتقال للرئيسية',
            onPress: () => router.replace('/home'),
          },
        ]
      );
    } catch (e) {
      router.replace('/home');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="sub"
        title={`أحياء ${city.name}`}
        subtitle="اختر حيك السكني لتلقي تنبيهات وخدمات الجيران"
        fallbackRoute="/cities"
      />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset }]} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
          <View style={[styles.searchBar, { borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface }]}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث عن اسم الحي..."
              placeholderTextColor="#94a3b8"
            />
            <Search size={20} color={OASIS.colors.primary} />
          </View>
        </View>

        <View style={styles.content}>
          {districts.map(d => (
            <Pressable oasisKind="card"
              key={d.id}
              style={styles.districtCard}
              onPress={() => selectDistrict(d.name)}
            >
              <CheckCircle2 size={18} color={OASIS.colors.primary} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.districtTitle}>حي {d.name}</Text>
                <Text style={styles.districtSub}>{city.name} · السعودية</Text>
              </View>
              <View style={styles.pinBox}>
                <MapPin size={18} color={OASIS.colors.primary} />
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
  districtCard: {
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
  pinBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  districtTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  districtSub: {
    color: OASIS.colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
