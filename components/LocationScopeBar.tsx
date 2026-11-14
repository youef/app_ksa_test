import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useState } from 'react';
import OasisGlassFrame from './home/OasisGlassFrame';
import { ActivityIndicator, Alert, Modal, Text, View, useWindowDimensions } from 'react-native';
import { Building2, Check, ChevronDown, MapPin, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { savePermanentMyLocation, type HaynaLocation } from '@/lib/locationSync';
import { isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';

type Props = {
  location: HaynaLocation;
  onLocationChanged?: (location: HaynaLocation) => void;
  compact?: boolean;
};

export default function LocationScopeBar({ location, onLocationChanged, compact = false }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState<'district' | 'city' | null>(null);
  const [open, setOpen] = useState(false);
  const hasCity = Boolean(location.city && location.city !== 'كل المدن');
  const districtMode = Boolean(hasCity && location.district && !['كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء'].includes(location.district));
  const cityMode = hasCity && !districtMode;

  async function chooseScope(scope: 'district' | 'city') {
    if (busy) return;
    setBusy(scope);
    try {
      // Resolve the actual device position; never use a sample neighborhood.
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
      if (!place || place.isOutsideKSA || !region || !city || (scope === 'district' && !district) || !isKnownSaudiCity(city)) {
        Alert.alert('تعذر التحقق من الموقع', scope === 'city' ? 'لم نستطع تحديد المدينة من الموقع الحالي. تحقق من صلاحية الموقع وأعد المحاولة.' : 'لم نستطع تحديد اسم الحي من بيانات الخرائط. يمكنك اختيار «المدينة كاملة» دون الحاجة إلى اسم الحي.');
        return;
      }
      const next: HaynaLocation = { region, city, district: scope === 'city' ? 'كل الأحياء' : district };
      await savePermanentMyLocation(next, true, { allowCityChange: true });
      onLocationChanged?.(next);
      setOpen(false);
    } catch (error: any) {
      Alert.alert('تعذر تحديث النطاق', error?.message || 'تحقق من الاتصال وإذن الموقع ثم حاول مرة أخرى.');
    } finally {
      setBusy(null);
    }
  }

  const title = hasCity
    ? (districtMode ? `حي ${location.district} · ${location.city}` : `كامل مدينة ${location.city}`)
    : 'حدد نطاق حيّك';
  const option = (scope: 'district' | 'city', label: string, description: string, selected: boolean) => {
    const Icon = scope === 'district' ? MapPin : Building2;
    return (
      <Pressable
        key={scope}
        onPress={() => { void chooseScope(scope); }}
        disabled={Boolean(busy)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ selected, disabled: Boolean(busy), busy: busy === scope }}
        style={{
          minHeight: 68, flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
          paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1,
          borderColor: selected ? colors.primary : colors.line,
          backgroundColor: selected ? colors.soft : colors.surface,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}>
          {busy === scope ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon size={20} color={colors.primary} />}
        </View>
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' }}>{label}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'right', marginTop: 3 }}>{description}</Text>
        </View>
        {selected && <Check size={19} color={colors.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
      </Pressable>
    );
  };

  return (
    <View style={{ marginHorizontal: compact ? 0 : 12, marginVertical: compact ? 0 : 6, flex: compact ? 1 : undefined, minWidth: 0 }}>
      <OasisGlassFrame variant="location" style={{ height: 44 }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`نطاق المنشورات: ${title}`}
          accessibilityHint="اضغط لتغيير نطاق الحي أو المدينة"
          accessibilityState={{ expanded: open, disabled: Boolean(busy) }}
          disabled={Boolean(busy)}
          style={{ minHeight: 44, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 14 }}
        >
          <MapPin size={17} color={colors.primary} />
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: compact ? 12 : 13, fontWeight: '700', textAlign: 'right' }}>{title}</Text>
          <ChevronDown size={16} color={colors.primary} />
        </Pressable>
      </OasisGlassFrame>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16), backgroundColor: 'rgba(8,35,25,0.55)' }}>
          <Pressable
            onPress={() => { if (!busy) setOpen(false); }}
            accessibilityRole="button"
            accessibilityLabel="إغلاق نافذة نطاق الموقع"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          />
          <View
            accessibilityViewIsModal
            style={{ width: '100%', maxWidth: Math.min(440, width - 32), padding: 18, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 19, fontWeight: '800', textAlign: 'right' }}>نطاق المنشورات</Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'right', marginTop: 4 }}>اختر المنشورات الأقرب لك حسب موقع جهازك</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                disabled={Boolean(busy)}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}
              >
                <X size={20} color={colors.ink} />
              </Pressable>
            </View>
            {option('district', 'حي موقعي', 'عرض المنشورات داخل الحي الذي يحدده جهازك', districtMode)}
            {option('city', 'المدينة كاملة', 'توسيع النتائج إلى جميع أحياء مدينتك', cityMode)}
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right' }}>يُستخدم موقع الجهاز للتحقق من نطاقك، ولن يتم اختيار حي افتراضي بدلاً عنه.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
