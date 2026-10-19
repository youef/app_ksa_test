import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Building2, MapPin } from 'lucide-react-native';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { savePermanentMyLocation, type HaynaLocation } from '@/lib/locationSync';
import { isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';

type Props = {
  location: HaynaLocation;
  onLocationChanged?: (location: HaynaLocation) => void;
};

export default function LocationScopeBar({ location, onLocationChanged }: Props) {
  const [busy, setBusy] = useState<'district' | 'city' | null>(null);
  const districtMode = Boolean(location.city && location.city !== 'كل المدن' && location.district && !['كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء'].includes(location.district));

  async function chooseScope(scope: 'district' | 'city') {
    if (busy) return;
    setBusy(scope);
    try {
      // Always resolve the real device location; never substitute sample city/district values.
      const device = await getCurrentDeviceLocation();
      if (!device) {
        Alert.alert('نحتاج إلى موقعك الحقيقي', 'فعّل إذن الموقع حتى نحدد المدينة والحي الفعليين، ولن نعرض أحياء أخرى كأنها حيّك.');
        return;
      }
      if (!isInsideSaudiArabia(device.latitude, device.longitude)) {
        Alert.alert('الموقع خارج المملكة', 'هذه الخدمة مخصصة لأحياء ومدن المملكة العربية السعودية.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(device);
      const region = place?.region?.trim() || '';
      const city = place?.city?.trim() || '';
      const district = place?.district?.trim() || '';
      if (!place || place.isOutsideKSA || !region || !city || !district || !isKnownSaudiCity(city)) {
        Alert.alert('تعذر التحقق من الموقع', 'لم نستطع تأكيد المنطقة والمدينة والحي من بيانات الموقع الحقيقية. أعد المحاولة بعد تفعيل GPS.');
        return;
      }
      const next: HaynaLocation = {
        region,
        city,
        district: scope === 'city' ? 'كل الأحياء' : district,
      };
      await savePermanentMyLocation(next, true, { allowCityChange: true });
      onLocationChanged?.(next);
    } catch (error: any) {
      Alert.alert('تعذر تحديث النطاق', error?.message || 'تحقق من الاتصال وإذن الموقع ثم حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  const title = location.city && location.city !== 'كل المدن'
    ? (districtMode ? `حي ${location.district} · ${location.city}` : `كامل مدينة ${location.city}`)
    : 'لم يتم التحقق من موقعك بعد';

  return (
    <View style={{ marginHorizontal: 12, marginTop: 8, marginBottom: 10, padding: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce9e1' }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <MapPin size={16} color="#176b52" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#17382c', fontSize: 12, fontWeight: '900', textAlign: 'right' }}>نطاق المنشورات</Text>
          <Text style={{ color: '#728178', fontSize: 11, textAlign: 'right', marginTop: 2 }}>{title}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
        <Pressable
          onPress={() => void chooseScope('district')}
          disabled={Boolean(busy)}
          accessibilityRole="button"
          accessibilityState={{ selected: districtMode, disabled: Boolean(busy) }}
          style={{ flex: 1, minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: districtMode ? '#176b52' : '#dce9e1', backgroundColor: districtMode ? '#176b52' : '#f7faf8', opacity: busy ? 0.7 : 1 }}
        >
          {busy === 'district' ? <ActivityIndicator size="small" color={districtMode ? '#fff' : '#176b52'} /> : <MapPin size={15} color={districtMode ? '#fff' : '#176b52'} />}
          <Text style={{ color: districtMode ? '#fff' : '#345348', fontSize: 12, fontWeight: '800' }}>حي موقعي</Text>
        </Pressable>
        <Pressable
          onPress={() => void chooseScope('city')}
          disabled={Boolean(busy)}
          accessibilityRole="button"
          accessibilityState={{ selected: !districtMode && Boolean(location.city && location.city !== 'كل المدن'), disabled: Boolean(busy) }}
          style={{ flex: 1, minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: !districtMode && location.city !== 'كل المدن' ? '#176b52' : '#dce9e1', backgroundColor: !districtMode && location.city !== 'كل المدن' ? '#176b52' : '#f7faf8', opacity: busy ? 0.7 : 1 }}
        >
          {busy === 'city' ? <ActivityIndicator size="small" color="#fff" /> : <Building2 size={15} color={!districtMode && location.city !== 'كل المدن' ? '#fff' : '#176b52'} />}
          <Text style={{ color: !districtMode && location.city !== 'كل المدن' ? '#fff' : '#345348', fontSize: 12, fontWeight: '800' }}>المدينة كاملة</Text>
        </Pressable>
      </View>
      <Text style={{ color: '#829087', fontSize: 10, lineHeight: 16, textAlign: 'right', marginTop: 8 }}>
        {districtMode ? 'تظهر المنشورات المطابقة لحيّك فقط.' : 'تظهر منشورات الأحياء داخل مدينتك فقط، دون المدن الأخرى.'}
      </Text>
    </View>
  );
}
