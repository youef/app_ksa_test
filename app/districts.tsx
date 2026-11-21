import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useState, useMemo } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buildSaudiLocations, normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { MapPin, Search, CheckCircle2, X } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { savePermanentMyLocation, getLockedCity } from '@/lib/locationSync';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALL_SAUDI_REGIONS = buildSaudiLocations();

export default function Districts() {
  const bottomNavInset = useBottomNavInset();
  const { regionName, cityName } = useLocalSearchParams<{ regionName: string; cityName: string }>();
  const [search, setSearch] = useState('');

  const city = useMemo(() => {
    for (const region of ALL_SAUDI_REGIONS) {
      const found = region.cities.find(item => item.name === cityName);
      if (found) return found;
    }
    return ALL_SAUDI_REGIONS[0].cities[0];
  }, [cityName]);

  const normalizedSearch = useMemo(() => normalizeSaudiLocationName(search), [search]);
  const districts = useMemo(() => {
    if (!normalizedSearch) return city.districts;
    return city.districts.filter(district =>
      normalizeSaudiLocationName(district.name).includes(normalizedSearch),
    );
  }, [city, normalizedSearch]);
  const hasQuery = search.trim().length > 0;

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

      // Save the selected location and keep the existing account/cache flow unchanged.
      await savePermanentMyLocation({
        region: regionName || 'المملكة',
        city: city.name,
        district: districtName,
      }, true);

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from('profiles')
          .update({ city: city.name, district: districtName })
          .eq('id', userData.user.id);

        const cached = await AsyncStorage.getItem(`@hayna_privacy_settings_${userData.user.id}`);
        const parsed = cached ? JSON.parse(cached) : {};
        parsed.city = city.name;
        parsed.district = districtName;
        await AsyncStorage.setItem(`@hayna_privacy_settings_${userData.user.id}`, JSON.stringify(parsed));
      }

      Alert.alert(
        'تم تحديد حيك بنجاح! 🏡',
        `تم ربط حسابك بـ ${city.name} · حي ${districtName}. مرحباً بك بين جيرانك!`,
        [
          {
            text: 'الانتقال للرئيسية',
            onPress: () => router.replace('/home'),
          },
        ],
      );
    } catch {
      Alert.alert(
        'تعذر حفظ اختيارك',
        'لم نتمكن من حفظ الحي الآن. يمكنك المحاولة مرة أخرى دون مغادرة صفحة اختيار الأحياء.',
        [
          { text: 'إعادة المحاولة', onPress: () => void selectDistrict(districtName) },
          { text: 'إلغاء', style: 'cancel' },
        ],
      );
    }
  }

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title={`أحياء ${city.name}`}
        subtitle="اختر حيك السكني لتلقي تنبيهات وخدمات الجيران"
        fallbackRoute="/cities"
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={20} color={OASIS.colors.primary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="اكتب اسم الحي..."
              placeholderTextColor={OASIS.colors.muted}
              accessibilityLabel="البحث عن حي"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {hasQuery ? (
              <Pressable
                oasisKind="plain"
                style={styles.clearSearch}
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel="مسح البحث"
              >
                <X size={18} color={OASIS.colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.resultCount} accessibilityLiveRegion="polite">
            عدد الأحياء: {districts.length.toLocaleString('ar-SA')}
          </Text>

          {districts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Search size={22} color={OASIS.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {hasQuery ? 'لا توجد أحياء مطابقة' : 'لا توجد أحياء مسجلة لهذه المدينة'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {hasQuery ? 'جرّب اسمًا آخر أو امسح البحث لعرض جميع الأحياء.' : 'يمكنك العودة لاختيار مدينة أخرى.'}
              </Text>
              <Pressable
                oasisKind="action"
                style={styles.emptyAction}
                onPress={() => hasQuery
                  ? setSearch('')
                  : router.replace({ pathname: '/cities', params: { regionName } })}
                accessibilityRole="button"
                accessibilityLabel={hasQuery ? 'عرض جميع الأحياء' : 'العودة لاختيار مدينة'}
              >
                <Text style={styles.emptyActionText}>
                  {hasQuery ? 'عرض جميع الأحياء' : 'اختيار مدينة أخرى'}
                </Text>
              </Pressable>
            </View>
          ) : (
            districts.map(district => (
              <Pressable
                oasisKind="plain"
                key={district.id}
                style={styles.districtCard}
                onPress={() => selectDistrict(district.name)}
                accessibilityRole="button"
                accessibilityLabel={`اختيار ${district.name} في ${city.name}`}
                accessibilityHint="لتحديد هذا الحي ضمن موقعك"
              >
                <CheckCircle2 size={20} color={OASIS.colors.primary} />
                <View style={styles.districtCopy}>
                  <Text style={styles.districtTitle} numberOfLines={2}>{district.name}</Text>
                  <Text style={styles.districtSub}>{city.name} · السعودية</Text>
                </View>
                <View style={styles.pinBox}>
                  <MapPin size={19} color={OASIS.colors.primary} />
                </View>
              </Pressable>
            ))
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
    paddingTop: 8,
  },
  searchSection: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    borderRadius: 18,
    paddingHorizontal: 10,
    minHeight: 56,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: OASIS.colors.ink,
    fontSize: 15,
    textAlign: 'right',
  },
  clearSearch: {
    width: 44,
    minWidth: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  resultCount: {
    color: OASIS.colors.muted,
    fontSize: 13,
    textAlign: 'right',
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  districtCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    minHeight: 76,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowOpacity: 0,
    elevation: 0,
    gap: 12,
  },
  districtCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 3,
  },
  pinBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  districtTitle: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  districtSub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    textAlign: 'right',
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 20,
    padding: 24,
    gap: 10,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: OASIS.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyAction: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: OASIS.colors.primary,
    marginTop: 6,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
