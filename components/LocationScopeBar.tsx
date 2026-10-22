import { useState } from 'react';
import OasisGlassFrame from './home/OasisGlassFrame';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Building2, ChevronDown, MapPin } from 'lucide-react-native';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { savePermanentMyLocation, type HaynaLocation } from '@/lib/locationSync';
import { isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';

type Props = {
  location: HaynaLocation;
  onLocationChanged?: (location: HaynaLocation) => void;
  compact?: boolean;
};

export default function LocationScopeBar({ location, onLocationChanged, compact = false }: Props) {
  const [busy, setBusy] = useState<'district' | 'city' | null>(null);
  const [open, setOpen] = useState(false);
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
    <View style={{ marginHorizontal: compact ? 0 : 12, marginTop: compact ? 0 : 6, marginBottom: compact ? 0 : 6, alignItems: 'stretch', zIndex: 20, flex: compact ? 1 : undefined }}>
      <OasisGlassFrame variant="location" style={{ minHeight: compact ? 54 : 46 }}>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ minHeight: compact ? 54 : 36, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: compact ? 20 : 14, paddingVertical: 0, borderRadius: 14, backgroundColor: 'transparent', borderWidth: 0 }}>
        <MapPin size={15} color="#176b52" />
        <Text numberOfLines={1} style={{ color: '#345348', fontSize: compact ? 11 : 12, fontWeight: '800', flexShrink: 1, textAlign: 'center', lineHeight: 17 }}>{title}</Text>
        <ChevronDown size={14} color="#176b52" />
      </Pressable>
      </OasisGlassFrame>
      {open && (
        <View style={{ marginTop: 5, width: 180, padding: 5, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce9e1', elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
          <Pressable onPress={() => { setOpen(false); void chooseScope('district'); }} disabled={Boolean(busy)} accessibilityRole="button" accessibilityState={{ selected: districtMode, disabled: Boolean(busy) }}
            style={{ minHeight: 38, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderRadius: 8, backgroundColor: districtMode ? '#e8f4ee' : '#fff' }}>
            {busy === 'district' ? <ActivityIndicator size="small" color="#176b52" /> : <MapPin size={15} color="#176b52" />}
            <Text style={{ color: '#345348', fontSize: 12, fontWeight: districtMode ? '900' : '600' }}>حي موقعي</Text>
          </Pressable>
          <Pressable onPress={() => { setOpen(false); void chooseScope('city'); }} disabled={Boolean(busy)} accessibilityRole="button" accessibilityState={{ selected: !districtMode && Boolean(location.city && location.city !== 'كل المدن'), disabled: Boolean(busy) }}
            style={{ minHeight: 38, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderRadius: 8, backgroundColor: !districtMode && location.city !== 'كل المدن' ? '#e8f4ee' : '#fff' }}>
            {busy === 'city' ? <ActivityIndicator size="small" color="#176b52" /> : <Building2 size={15} color="#176b52" />}
            <Text style={{ color: '#345348', fontSize: 12, fontWeight: !districtMode && location.city !== 'كل المدن' ? '900' : '600' }}>المدينة كاملة</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
