import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MapPin, LocateFixed, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { savePermanentMyLocation, isAllKingdom } from '@/lib/locationSync';
import { isInsideSaudiArabia, isKnownSaudiCity, SAUDI_REGIONS } from '@/lib/saudiLocations';

const ENGLISH_CITIES: Record<string, string> = {
  riyadh: 'الرياض', jeddah: 'جدة', jiddah: 'جدة', makkah: 'مكة المكرمة',
  mecca: 'مكة المكرمة', madinah: 'المدينة المنورة', medina: 'المدينة المنورة',
  dammam: 'الدمام', khobar: 'الخبر', alkhobar: 'الخبر', dhahran: 'الظهران',
  arar: 'عرعر', rafha: 'رفحاء', tabuk: 'تبوك', hail: 'حائل',
  abha: 'أبها', 'khamis mushait': 'خميس مشيط', taif: 'الطائف',
  yanbu: 'ينبع', jubail: 'الجبيل', najran: 'نجران', jazan: 'جازان',
  sakaka: 'سكاكا', buraydah: 'بريدة', unaizah: 'عنيزة',
  'al baha': 'الباحة', 'al ahsa': 'الأحساء', hofuf: 'الهفوف',
};
function resolveCity(raw: string): { city: string; region: string } | null {
  const cleaned = raw.trim().toLowerCase().replace(/^al[ -]/, '').replace(/[-_]/g, ' ');
  const translated = ENGLISH_CITIES[cleaned] || raw.trim();
  if (isKnownSaudiCity(translated) && translated !== 'المملكة') {
    const matched = SAUDI_REGIONS.find(r => r.cities.some(c => c.name === translated || c.name === 'مدينة ' + translated));
    return { city: matched?.cities.find(c => c.name === translated || c.name === 'مدينة ' + translated)?.name || translated, region: matched?.name || '' };
  }
  // Do not substitute a nearby city: the address must come from GPS reverse geocoding.
  return null;
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

    })().catch(() => { if (active) { setChecking(false); setError('تعذر التحقق من الحساب. حاول مرة أخرى.'); } });
    return () => { active = false; };
  }, []);

  function detect() {
    if (loading) return;
    setLoading(true);
    setError('');
    setLocation(null);

    // On mobile browsers the OS permission prompt must be initiated directly
    // from a user gesture, not after an awaited Supabase/Expo permission call.
    const webGeo = Platform.OS === 'web'
      ? (globalThis as any).navigator?.geolocation
      : null;

    const obtainPosition: Promise<{ latitude: number; longitude: number; accuracy: number | null }> =
      Platform.OS === 'web'
        ? new Promise((resolve, reject) => {
            if (!webGeo) { reject(new Error('المتصفح لا يدعم تحديد الموقع. افتح الرابط في Safari أو Chrome عبر HTTPS.')); return; }
            webGeo.getCurrentPosition(
              (p: any) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
              (e: any) => reject(new Error(e?.code === 1
                ? 'تم رفض إذن الموقع أو حظره سابقًا. اسمح بالموقع من إعدادات Safari أو Chrome ثم أعد المحاولة.'
                : e?.code === 3 ? 'انتهت مهلة تحديد الموقع. تأكد من تشغيل خدمات الموقع وحاول مرة أخرى.'
                : 'تعذر الحصول على إحداثيات الجهاز. تحقق من تشغيل خدمات الموقع.')),
              { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
            );
          })
        : Location.requestForegroundPermissionsAsync().then(async permission => {
            if (permission.status !== 'granted') throw new Error('يرجى السماح بالوصول للموقع من إعدادات الجهاز.');
            const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
            return { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy };
          });

    void obtainPosition.then(async coords => {
      if (!isInsideSaudiArabia(coords.latitude, coords.longitude)) {
        throw new Error('الموقع المستخرج خارج نطاق المملكة العربية السعودية.');
      }
      let address: Location.LocationGeocodedAddress | undefined;
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
        address = results[0];
      } catch { /* Try the secondary geocoder below. */ }

      let resolved = resolveCity(address?.city || address?.subregion || '');
      let district = (address?.district || '').trim();
      let region = resolved?.region || address?.region || '';

      // Some devices return city only; query an address geocoder rather than
      // guessing a neighborhood from coordinates or a nearby city.
      if ((!resolved || !district) && Platform.OS === 'web') {
        try {
          const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ar&zoom=18&lat='
            + encodeURIComponent(String(coords.latitude)) + '&lon=' + encodeURIComponent(String(coords.longitude));
          const response = await fetch(url, { headers: { Accept: 'application/json' } });
          if (response.ok) {
            const data = await response.json();
            const addr = data?.address || {};
            resolved = resolved || resolveCity(addr.city || addr.town || addr.village || addr.municipality || '');
            district = district || String(addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || '').trim();
            region = resolved?.region || region || String(addr.state || '');
          }
        } catch { /* Show verified city without inventing a district. */ }
      }

      // Independent address provider: some Saudi neighborhoods are not present
      // in Apple's/Android's reverse geocoder or Nominatim response.
      if (!district) {
        try {
          const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='
            + encodeURIComponent(String(coords.latitude))
            + '&longitude=' + encodeURIComponent(String(coords.longitude))
            + '&localityLanguage=ar';
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const entries: Array<{ name?: string; description?: string }> = Array.isArray(data.localityInfo?.informative)
              ? data.localityInfo.informative : [];
            const neighborhood = entries.find(entry =>
              /neighbou?rhood|suburb|quarter|district|حي|ضاحية/i.test(entry.description || '')
              && entry.name && entry.name.trim() !== resolved?.city
            );
            district = String(neighborhood?.name || '').trim();
            resolved = resolved || resolveCity(String(data.city || data.locality || ''));
          }
        } catch { /* No unsupported neighborhood guess. */ }
      }
      // A city alone is not a verified neighborhood; never save it as if it were.
      if (!district) throw new Error('تم تحديد المدينة من GPS لكن مزودي الخرائط لم يرجعوا اسم الحي. تأكد من تفعيل الموقع الدقيق ثم أعد المحاولة.');
      if (!resolved) throw new Error('تم الحصول على إحداثياتك، لكن تعذر تحديد اسم المدينة من خدمات العناوين. حاول مجددًا.');
      setLocation({ city: resolved.city, region: resolved.region || region || 'المملكة العربية السعودية', district });
    }).catch(e => {
      setError(e instanceof Error ? e.message : 'تعذر استخراج الموقع، حاول مجددًا.');
    }).finally(() => setLoading(false));
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

    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.iconWrap}><MapPin size={35} color="#047857" strokeWidth={1.8} /></View>
      <Text style={styles.title}>أهلًا بك في حيّنا</Text>
      <Text style={styles.subtitle}>حدّد موقعك للانضمام إلى مجتمع حيّك</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>موقعك أولًا</Text>
        <Text style={styles.body}>نستخدم موقعك لتحديد مدينتك وحيّك وعرض اليوميات والخدمات القريبة منك. هذه الخطوة مطلوبة قبل الدخول للصفحة الرئيسية.</Text>
        {checking ? <ActivityIndicator color="#047857" style={{ marginVertical: 22 }} /> : <>
          {location ? <View style={styles.result}><MapPin size={22} color="#047857" /><View style={{ flex: 1 }}><Text style={styles.city}>{location.city}</Text><Text style={styles.district}>{location.district ? location.district + ' · ' : 'لم تتوفر تسمية الحي · '}{location.region}</Text></View></View> : null}
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
  page: { flex: 1, backgroundColor: 'transparent' },
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
