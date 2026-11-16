import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, CheckCircle2, MapPin, ShieldCheck } from 'lucide-react-native';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';
import { registerPushToken } from '@/lib/notifications';
import { useTheme } from '@/context/ThemeContext';
import type { HaynaLocation } from '@/lib/locationSync';

const INTRO_KEY = '@hayna_permissions_welcome_v1:';
type Props = { userId: string; onLocation: (location: HaynaLocation) => Promise<void> };

/** Consent is collected on a first signed-in visit, separately for location and push. */
export default function FirstRunPermissions({ userId, onLocation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<'location' | 'notifications' | null>(null);
  const [locationDone, setLocationDone] = useState(false);
  const [pushDone, setPushDone] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setVisible(false);
    setLocationDone(false);
    setPushDone(false);
    setMessage('');
    void AsyncStorage.getItem(INTRO_KEY + userId)
      .then(value => { if (active && value !== 'completed') setVisible(true); })
      .catch(() => { if (active) setVisible(true); });
    return () => { active = false; };
  }, [userId]);

  const close = useCallback(() => {
    if (busy) return;
    setVisible(false);
    // One prompt per account, even when they choose "not now".
    void AsyncStorage.setItem(INTRO_KEY + userId, 'completed')
      .catch(error => console.warn('Could not store onboarding preference:', error));
  }, [userId, busy]);

  const enableLocation = async () => {
    if (busy) return;
    setBusy('location');
    setMessage('');
    try {
      const device = await getCurrentDeviceLocation();
      if (!device) throw new Error('تعذّر تحديد موقعك. اسمح بالوصول للموقع في إعدادات الجهاز أو المتصفح.');
      if (!isInsideSaudiArabia(device.latitude, device.longitude)) {
        throw new Error('موقعك الحالي خارج المملكة؛ يمكنك ضبط حيك من إعدادات التطبيق.');
      }
      const place = await reverseGeocodeDeviceLocation(device);
      if (!place || place.isOutsideKSA || !place.region?.trim() || !place.city?.trim() ||
        !place.district?.trim() || !isKnownSaudiCity(place.city)) {
        throw new Error('لم نستطع تحديد المدينة والحي بدقة. فعّل GPS أو اختر الموقع يدويًا.');
      }
      await onLocation({ region: place.region.trim(), city: place.city.trim(), district: place.district.trim() });
      setLocationDone(true);
      setMessage('تم حفظ موقعك الحالي وتحديث الحي.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر تحديد الموقع، حاول مجددًا.');
    } finally {
      setBusy(null);
    }
  };

  const enableNotifications = async () => {
    if (busy) return;
    setBusy('notifications');
    setMessage('');
    try {
      const token = await registerPushToken();
      if (!token) throw new Error('تعذر تسجيل جهازك في خدمة الإشعارات.');
      setPushDone(true);
      setMessage('تم تفعيل إشعارات حيّنا.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تفعيل التنبيهات، حاول مجددًا.');
    } finally {
      setBusy(null);
    }
  };

  const needsIOSInstall = Platform.OS === 'web' && typeof navigator !== 'undefined'
    && /iPad|iPhone|iPod/.test(navigator.userAgent) && typeof window !== 'undefined'
    && !window.matchMedia('(display-mode: standalone)').matches && (navigator as any).standalone !== true;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.symbol, { backgroundColor: colors.soft }]}><ShieldCheck size={26} color={colors.primary} /></View>
          <Text style={[styles.title, { color: colors.ink }]}>جهّز حيّنا لحارتك</Text>
          <Text style={[styles.intro, { color: colors.muted }]}>عشان تشوف أخبار وخدمات حيك، فعّل الموقع الحالي والتنبيهات. الخيار لك.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="تفعيل موقعي الحالي" disabled={busy !== null || locationDone}
            onPress={() => void enableLocation()} style={[styles.action, { backgroundColor: colors.soft, borderColor: colors.line }]}>
            <View style={styles.copy}>
              <Text style={[styles.actionTitle, { color: colors.ink }]}>{locationDone ? 'تم تحديد الموقع' : 'تفعيل موقعي الحالي'}</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>تحديد المنطقة والمدينة والحي</Text>
            </View>
            {busy === 'location' ? <ActivityIndicator color={colors.primary} /> : locationDone ? <CheckCircle2 size={22} color={colors.primary} /> : <MapPin size={22} color={colors.primary} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="تفعيل الإشعارات" disabled={busy !== null || pushDone}
            onPress={() => void enableNotifications()} style={[styles.action, { backgroundColor: colors.soft, borderColor: colors.line }]}>
            <View style={styles.copy}>
              <Text style={[styles.actionTitle, { color: colors.ink }]}>{pushDone ? 'التنبيهات مفعلة' : 'تفعيل الإشعارات'}</Text>
              <Text style={[styles.hint, { color: colors.muted }]}>الرسائل والتنبيهات المحلية</Text>
            </View>
            {busy === 'notifications' ? <ActivityIndicator color={colors.primary} /> : pushDone ? <CheckCircle2 size={22} color={colors.primary} /> : <BellRing size={22} color={colors.primary} />}
          </Pressable>
          {needsIOSInstall ? <Text style={[styles.message, { color: colors.muted }]}>تنبيهات الآيفون تتطلب إضافة حيّنا إلى الشاشة الرئيسية من Safari ثم فتحه عبر الأيقونة.</Text> : null}
          {!!message && <Text accessibilityRole="alert" style={[styles.message, { color: colors.primary }]}>{message}</Text>}
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={close}
            style={[styles.finish, { backgroundColor: colors.primary, opacity: busy ? .6 : 1 }]}>
            <Text style={styles.finishText}>{locationDone || pushDone ? 'متابعة إلى حيّنا' : 'ليس الآن، متابعة إلى حيّنا'}</Text>
          </Pressable>
          <Text style={[styles.privacy, { color: colors.muted }]}>يمكنك تغيير الصلاحيات من إعدادات الجهاز والتطبيق لاحقًا.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3,18,13,.66)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  panel: { width: '100%', maxWidth: 430, borderRadius: 28, borderWidth: 1, padding: 22, alignItems: 'stretch', gap: 12 },
  symbol: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { textAlign: 'center', fontSize: 22, fontWeight: '800' },
  intro: { textAlign: 'center', fontSize: 13, lineHeight: 22, marginBottom: 6 },
  action: { flexDirection: 'row-reverse', minHeight: 68, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  actionTitle: { textAlign: 'right', fontSize: 15, fontWeight: '700' },
  hint: { textAlign: 'right', fontSize: 11, lineHeight: 18 },
  message: { textAlign: 'center', fontSize: 12, lineHeight: 20 },
  finish: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  finishText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  privacy: { textAlign: 'center', fontSize: 11, lineHeight: 17 },
});
