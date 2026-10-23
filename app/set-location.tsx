import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MapPin, LocateFixed, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { savePermanentMyLocation, getPermanentMyLocation, isAllKingdom } from '@/lib/locationSync';
import { isInsideSaudiArabia, isKnownSaudiCity, SAUDI_REGIONS } from '@/lib/saudiLocations';

const ENGLISH_CITIES: Record<string, string> = {
  riyadh: 'الرياض', jeddah: 'جدة', jiddah: 'جدة', makkah: 'مكة المكرمة',
  mecca: 'مكة المكرمة', madinah: 'المدينة المنورة', medina: 'المدينة المنورة',
  dammam: 'الدمام', khobar: 'الخبر', alkhobar: 'الخبر', dhahran: 'الظهران',
  arar: 'عرعر', rafha: 'رفحاء', tabuk: 'تبوك', hail: 'حائل',
  abha: 'أبها', khamis mushait: 'خميس مشيط', taif: 'الطائف',
  yanbu: 'ينبع', jubail: 'الجبيل', najran: 'نجران', jazan: 'جازان',
  sakaka: 'سكاكا', buraydah: 'بريدة', unaizah: 'عنيزة',
  al baha: 'الباحة', al ahsa: 'الأحساء', hofuf: 'الهفوف',
};
function resolveCity(raw: string, latitude: number, longitude: number): { city: string; region: string } | null {
  const cleaned = raw.trim().toLowerCase().replace(/^al[ -]/, '').replace(/[-_]/g, ' ');
  const translated = ENGLISH_CITIES[cleaned] || raw.trim();
  if (isKnownSaudiCity(translated) && translated !== 'المملكة') {
    const matched = SAUDI_REGIONS.find(r => r.cities.some(c => c.name === translated || c.name === 'مدينة ' + translated));
    return { city: matched?.cities.find(c => c.name === translated || c.name === 'مدينة ' + translated)?.name || translated, region: matched?.name || '' };
  }
  // Reverse geocoding on Safari can return English or administrative names.
  // Use a nearby verified Saudi city, but never guess a distant location.
  let nearest: { city: string; region: string; distance: number } | null = null;
  for (const region of SAUDI_REGIONS) for (const city of region.cities) {
    if (typeof city.lat !== 'number' || typeof city.lng !== 'number') continue;
    const a = Math.sin((city.lat - latitude) * Math.PI / 360) ** 2 +
      Math.cos(latitude * Math.PI / 180) * Math.cos(city.lat * Math.PI / 180) *
      Math.sin((city.lng - longitude) * Math.PI / 360) ** 2;
    const distance = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
    if (!nearest || distance < nearest.distance) nearest = { city: city.name, region: region.name, distance };
  }
  return nearest && nearest.distance <= 35 ? { city: nearest.city, region: nearest.region } : null;
}

export default function SetLocationScreen() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ region: string; city: string; district: string } | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) { router.replace('/auth'); return; }
      const { data: profile } = await supabase.from('profiles').select('region,city,district').eq('id', data.user.id).maybeSingle();
      if (!active) return;
      if (profile?.city && !isAllKingdom(profile.city) && isKnownSaudiCity(profile.city)) {
        router.replace('/home');
        return;
      }
      setChecking(false);
      void detect();
    })().catch(() => { if (active) { setChecking(false); setError('تعذر التحقق من الحساب. حاول مرة أخرى.'); } });
    return () => { active = false; };
  }, []);

  async function detect() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('يجب السماح بالوصول للموقع من إعدادات الجهاز لإكمال الإعداد.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!isInsideSaudiArabia(position.coords.latitude, position.coords.longitude)) throw new Error('الخدمة متاحة للمواقع داخل المملكة العربية السعودية فقط.');
      const results = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const result = results[0];
      const resolved = resolveCity(result?.city || result?.subregion || '', position.coords.latitude, position.coords.longitude);
      const city = resolved?.city || '';
      const region = resolved?.region || result?.region || 'المملكة العربية السعودية';
      const district = (result?.district || result?.name || 'كل الأحياء').trim();
      if (!city || !isKnownSaudiCity(city)) throw new Error('تم السماح بالموقع، لكن تعذر مطابقة المدينة. فعّل الموقع الدقيق وأعد المحاولة.');
      setLocation({ city, region, district });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديد موقعك، حاول مجددًا.');
    } finally { setLoading(false); }
  }

  async function confirm() {
    if (!location || loading) return;
    setLoading(true);
    setError('');
    try {
      await savePermanentMyLocation(location, true, { allowCityChange: true });
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ الموقع. حاول مرة أخرى.');
    } finally { setLoading(false); }
  }

  return <View style={styles.page}>
    <ImageBackground source={{ uri: Platform.OS === 'web' ? '/welcome/hayna-heritage-bg.png' : 'https://appksatest.vercel.app/welcome/hayna-heritage-bg.png' }} style={StyleSheet.absoluteFillObject} resizeMode="cover" imageStyle={{ opacity: 0.22 }} />
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.iconWrap}><MapPin size={35} color="#047857" strokeWidth={1.8} /></View>
      <Text style={styles.title}>أهلًا بك في حيّنا</Text>
      <Text style={styles.subtitle}>حدّد موقعك للانضمام إلى مجتمع حيّك</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>موقعك أولًا</Text>
        <Text style={styles.body}>نستخدم موقعك لتحديد مدينتك وحيّك وعرض اليوميات والخدمات القريبة منك. هذه الخطوة مطلوبة قبل الدخول للصفحة الرئيسية.</Text>
        {checking ? <ActivityIndicator color="#047857" style={{ marginVertical: 22 }} /> : <>
          {location ? <View style={styles.result}><MapPin size={22} color="#047857" /><View style={{ flex: 1 }}><Text style={styles.city}>{location.city}</Text><Text style={styles.district}>{location.district} · {location.region}</Text></View></View> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={loading} onPress={location ? confirm : detect} style={[styles.button, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : location ? <ArrowLeft size={20} color="#fff" /> : <LocateFixed size={20} color="#fff" />}
            <Text style={styles.buttonText}>{location ? 'تأكيد الموقع والدخول' : 'تحديد موقعي الآن'}</Text>
          </Pressable>
          {location ? <Pressable onPress={() => { setLocation(null); void detect(); }} style={styles.retry}><RefreshCw size={15} color="#047857" /><Text style={styles.retryText}>إعادة تحديد الموقع</Text></Pressable> : null}
        </>}
      </View>
      <View style={styles.privacy}><ShieldCheck size={18} color="#047857" /><Text style={styles.privacyText}>لن يتم نشر إحداثياتك الدقيقة للآخرين.</Text></View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7fbf7' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 22, paddingVertical: 55 },
  iconWrap: { width: 82, height: 82, borderRadius: 27, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 29, fontWeight: '900', color: '#064e3b', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#476b59', textAlign: 'center', marginTop: 8, marginBottom: 30 },
  card: { width: '100%', maxWidth: 470, borderRadius: 25, padding: 23, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#d6e9db' },
  heading: { fontSize: 20, fontWeight: '900', color: '#064e3b', textAlign: 'right' },
  body: { fontSize: 14, lineHeight: 25, color: '#526a5e', textAlign: 'right', marginTop: 9, marginBottom: 22 },
  result: { flexDirection: 'row-reverse', gap: 12, alignItems: 'center', backgroundColor: '#ecfdf5', borderRadius: 16, padding: 16, marginBottom: 16 },
  city: { fontSize: 18, color: '#064e3b', fontWeight: '900', textAlign: 'right' },
  district: { fontSize: 12, color: '#47735b', textAlign: 'right', marginTop: 4 },
  button: { minHeight: 55, borderRadius: 16, backgroundColor: '#047857', flexDirection: 'row-reverse', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  retry: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, padding: 15 },
  retryText: { color: '#047857', fontWeight: '800' },
  error: { color: '#b91c1c', textAlign: 'right', marginBottom: 15, lineHeight: 22 },
  privacy: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center', marginTop: 25 },
  privacyText: { fontSize: 12, color: '#4b6d5d' },
});
