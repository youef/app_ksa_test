import { useState, useMemo } from 'react';
import {
  Alert,
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
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronRight, MapPin, Search, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';

export default function Districts() {
  const { regionName, cityName } = useLocalSearchParams<{ regionName: string; cityName: string }>();
  const [search, setSearch] = useState('');

  const city = useMemo(() => {
    for (const r of SAUDI_REGIONS) {
      const found = r.cities.find(c => c.name === cityName);
      if (found) return found;
    }
    return SAUDI_REGIONS[0].cities[0];
  }, [cityName]);

  const districts = useMemo(() => {
    return city.districts.filter(d => d.includes(search.trim()));
  }, [city, search]);

  async function selectDistrict(districtName: string) {
    try {
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>أحياء {city.name}</Text>
            <View style={{ width: 28 }} />
          </View>
          <Text style={styles.heroSub}>
            اضغط على حيك السكني لربطه بحسابك وتلقي تنبيهات وخدمات الجيران.
          </Text>

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث عن اسم الحي..."
              placeholderTextColor="#94a3b8"
            />
            <Search size={20} color="#059669" />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {districts.map(d => (
            <Pressable
              key={d}
              style={styles.districtCard}
              onPress={() => selectDistrict(d)}
            >
              <CheckCircle2 size={18} color="#059669" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.districtTitle}>حي {d}</Text>
                <Text style={styles.districtSub}>{city.name} · السعودية</Text>
              </View>
              <View style={styles.pinBox}>
                <MapPin size={18} color="#059669" />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
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
  districtCard: {
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
  pinBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  districtTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  districtSub: {
    color: '#64748b',
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
