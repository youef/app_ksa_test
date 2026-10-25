import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  getActiveLocation,
  savePermanentMyLocation,
  subscribeLocation,
  isExactDistrictMatching,
  isLocationMatching,
  getLockedCity,
  type HaynaLocation,
  type LockedCity,
} from '@/lib/locationSync';
import { CurrentWeather, loadCurrentWeather } from '@/lib/weather';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';
import { registerPushToken } from '@/lib/notifications';
import type { Profile } from '@/lib/homeUtils';

const LAST_CHECK_KEY = '@hayna_location_last_auto_check_v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const WEATHER_REFRESH = 30 * 60 * 1000;

type Options = {
  setProfile: (updater: (current: Profile | null) => Profile) => void;
  showToast: (msg: string) => void;
};

export function useHomeLocation({ setProfile, showToast }: Options) {
  const [region, setRegion] = useState('كل المملكة');
  const [city, setCity] = useState('كل المدن');
  const [district, setDistrict] = useState('كل الأحياء');
  const [ready, setReady] = useState(false);

  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [promptVisible, setPromptVisible] = useState(false);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [weeklyMessage, setWeeklyMessage] = useState('');
  const [lockedCity, setLockedCityState] = useState<LockedCity | null>(null);

  const refreshLockedCity = useCallback(async () => {
    setLockedCityState(await getLockedCity());
  }, []);

  const apply = useCallback((loc: HaynaLocation) => {
    setRegion(loc.region);
    setCity(loc.city);
    setDistrict(loc.district);
  }, []);

  // Initial + live location sync
  useEffect(() => {
    let active = true;
    getActiveLocation().then(loc => {
      if (!active) return;
      apply(loc);
      setReady(true);
    });
    void refreshLockedCity();
    const unsub = subscribeLocation(apply);
    return () => { active = false; unsub(); };
  }, [apply, refreshLockedCity]);

  // Weather: refresh on location change and every 30 min
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const update = async () => {
      setWeatherLoading(true);
      try {
        const w = await loadCurrentWeather(region, city, district);
        if (active) setWeather(w);
      } catch (e) {
        console.warn('Weather update failed', e);
        if (active) setWeather(null);
      } finally {
        if (active) setWeatherLoading(false);
      }
    };
    void update();
    const id = setInterval(update, WEATHER_REFRESH);
    return () => { active = false; clearInterval(id); };
  }, [ready, region, city, district]);

  // Mandatory weekly location check. The prompt stays until the real GPS
  // location is confirmed, so it can never be skipped or snoozed away.
  useEffect(() => {
    let active = true;
    (async () => {
      const lastRaw = await AsyncStorage.getItem(LAST_CHECK_KEY);
      const last = Number(lastRaw) || 0;
      const due = !last || Date.now() - last >= WEEK;
      if (active && due) setPromptVisible(true);
    })();
    return () => { active = false; };
  }, []);

  const resolveLiveLocation = useCallback(async () => {
    const device = await getCurrentDeviceLocation();
    if (!device) return null;
    if (!isInsideSaudiArabia(device.latitude, device.longitude)) {
      return null;
    }
    const place = await reverseGeocodeDeviceLocation(device);
    if (!place || place.isOutsideKSA) return null;
    const live = {
      region: place?.region?.trim() || '',
      city: place?.city?.trim() || '',
      district: place?.district?.trim() || '',
    };
    return live.region && live.city && live.district && isKnownSaudiCity(live.city) ? live : null;
  }, []);

  const persistLocation = useCallback(async (live: HaynaLocation) => {
    await savePermanentMyLocation(live, true, { allowCityChange: true });
    apply(live);
    setProfile(current => ({ ...(current || ({} as Profile)), ...live }));
    await refreshLockedCity();
  }, [apply, refreshLockedCity, setProfile]);

  const acceptWeeklyCheck = useCallback(async () => {
    if (weeklyBusy) return;
    setWeeklyBusy(true);
    setWeeklyMessage('جارٍ التحقق من موقعك الحقيقي عبر GPS…');
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setWeeklyMessage('سجّل الدخول أو أنشئ حساباً لتأكيد موقعك ومتابعة حيّك.');
        return;
      }
      const device = await getCurrentDeviceLocation();
      if (!device) {
        setWeeklyMessage(
          'لم نتمكن من قراءة موقعك الحقيقي. اسمح للتطبيق أو المتصفح بالوصول إلى الموقع، ثم اضغط «تحديث الآن» مرة أخرى.'
        );
        return;
      }
      if (!isInsideSaudiArabia(device.latitude, device.longitude)) {
        setWeeklyMessage(
          'موقع جهازك الحالي خارج المملكة العربية السعودية 🇸🇦. تطبيق حينا مخصص لمدن وأحياء المملكة.'
        );
        return;
      }
      const live = await resolveLiveLocation();
      if (!live) {
        setWeeklyMessage(
          'لم نتمكن من مطابقة موقعك مع مدن المملكة بدقة. تأكد من تفعيل GPS أو اختر موقعك يدوياً.'
        );
        return;
      }
      await persistLocation(live);
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
      setWeeklyMessage('');
      setPromptVisible(false);
      showToast('تم تثبيت موقعك الحقيقي ✓');
    } catch (e) {
      console.warn('weekly location check failed:', e);
      setWeeklyMessage('تعذّر تحديث موقعك الآن. تحقّق من إذن الموقع ثم أعد المحاولة.');
    } finally {
      setWeeklyBusy(false);
    }
  }, [weeklyBusy, persistLocation, resolveLiveLocation, showToast]);

  const setupRequiredLocation = useCallback(async () => {
    if (setupBusy) return;
    setSetupBusy(true);
    setSetupMessage('جارٍ تحديد موقعك وقراءة المنطقة والمدينة والحي…');
    try {
      const device = await getCurrentDeviceLocation();
      if (device && !isInsideSaudiArabia(device.latitude, device.longitude)) {
        setSetupMessage('موقعك الحالي خارج المملكة العربية السعودية 🇸🇦. التطبيق مخصص لأحياء ومدن المملكة.');
        return;
      }
      const live = await resolveLiveLocation();
      if (!live) {
        setSetupMessage('لم نتمكن من تحديد المنطقة والمدينة والحي بدقة داخل المملكة. فعّل إذن الموقع ثم حاول مرة أخرى.');
        return;
      }
      await persistLocation(live);
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
      setSetupMessage('تم حفظ موقعك. نطلب الآن تفعيل الإشعارات حتى لا تفوتك تنبيهات الحي…');
      const token = await registerPushToken();
      setSetupOpen(false);
      showToast(
        token
          ? 'تم ربط حسابك بموقعك وتفعيل الإشعارات ✓'
          : 'تم حفظ موقعك. يمكنك تفعيل الإشعارات لاحقاً من الإعدادات.',
      );
    } catch (e: any) {
      setSetupMessage(e?.message || 'تعذر إكمال الإعداد. حاول مرة أخرى.');
    } finally {
      setSetupBusy(false);
    }
  }, [setupBusy, resolveLiveLocation, persistLocation, showToast]);

  const enableNotifications = useCallback(async () => {
    if (setupBusy) return;
    setSetupBusy(true);
    setSetupMessage('جارٍ طلب إذن الإشعارات…');
    try {
      const token = await registerPushToken();
      setSetupOpen(false);
      showToast(
        token
          ? 'تم تفعيل إشعارات حيّك ✓'
          : 'تم الدخول. الإشعارات غير مفعلة ويمكن تفعيلها لاحقاً من الإعدادات.',
      );
    } catch (e) {
      // Denied permission / unsupported browser must never crash the app.
      console.warn('enableNotifications skipped:', e);
      setSetupOpen(false);
      showToast('تم الدخول. الإشعارات غير مفعلة ويمكن تفعيلها لاحقاً من الإعدادات.');
    } finally {
      setSetupBusy(false);
    }
  }, [setupBusy, showToast]);

  const hasExactLocation =
    city !== 'كل المدن' && district !== 'كل الأحياء' && district !== 'كل أحياء المدينة';

  const matchesLocation = useCallback(
    (item: { city?: string | null; district?: string | null }) =>
      district && !['كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء', 'الكل'].includes(district.trim())
        ? isExactDistrictMatching(item, city, district)
        : isLocationMatching(item, city, 'كل الأحياء'),
    [city, district],
  );

  return {
    region, city, district, ready, apply,
    weather, weatherLoading,
    setupOpen, setSetupOpen, setupBusy, setupMessage,
    promptVisible, weeklyBusy, weeklyMessage, acceptWeeklyCheck,
    setupRequiredLocation, enableNotifications,
    hasExactLocation, matchesLocation, lockedCity,
    persistLocation,
  };
}
