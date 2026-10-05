import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  getActiveLocation,
  savePermanentMyLocation,
  subscribeLocation,
  isExactDistrictMatching,
  type HaynaLocation,
} from '@/lib/locationSync';
import { CurrentWeather, loadCurrentWeather } from '@/lib/weather';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { registerPushToken } from '@/lib/notifications';
import type { Profile } from '@/lib/homeUtils';

const LAST_CHECK_KEY = '@hayna_location_last_auto_check_v1';
const SNOOZE_KEY = '@hayna_location_prompt_snooze_v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
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
    const unsub = subscribeLocation(apply);
    return () => { active = false; unsub(); };
  }, [apply]);

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

  // Weekly location check (with a 24h snooze so the prompt never loops)
  useEffect(() => {
    let active = true;
    (async () => {
      const [lastRaw, snoozeRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_CHECK_KEY),
        AsyncStorage.getItem(SNOOZE_KEY),
      ]);
      const last = Number(lastRaw) || 0;
      const snoozedUntil = Number(snoozeRaw) || 0;
      const due = !last || Date.now() - last >= WEEK;
      if (active && due && Date.now() > snoozedUntil) setPromptVisible(true);
    })();
    return () => { active = false; };
  }, []);

  const resolveLiveLocation = useCallback(async () => {
    const device = await getCurrentDeviceLocation();
    if (!device) return null;
    const place = await reverseGeocodeDeviceLocation(device);
    const live = {
      region: place?.region?.trim() || '',
      city: place?.city?.trim() || '',
      district: place?.district?.trim() || '',
    };
    return live.region && live.city && live.district ? live : null;
  }, []);

  const persistLocation = useCallback(async (live: HaynaLocation) => {
    await savePermanentMyLocation(live, true);
    apply(live);
    setProfile(current => ({ ...(current || ({} as Profile)), ...live }));
  }, [apply, setProfile]);

  const snoozePrompt = useCallback(async () => {
    setPromptVisible(false);
    await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY));
  }, []);

  const acceptWeeklyCheck = useCallback(async () => {
    setPromptVisible(false);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const live = await resolveLiveLocation();
      if (!live) throw new Error('no-location');
      await persistLocation(live);
      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
      showToast('تم تحديث موقعك ✓');
    } catch (e) {
      console.warn('weekly location check failed:', e);
      await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY));
      showToast('تعذر تحديد موقعك، سنحاول لاحقاً. يمكنك التحديث من الملف الشخصي.');
    }
  }, [persistLocation, resolveLiveLocation, showToast]);

  const setupRequiredLocation = useCallback(async () => {
    if (setupBusy) return;
    setSetupBusy(true);
    setSetupMessage('جارٍ تحديد موقعك وقراءة المنطقة والمدينة والحي…');
    try {
      const live = await resolveLiveLocation();
      if (!live) {
        setSetupMessage('لم نتمكن من تحديد المنطقة والمدينة والحي بدقة. فعّل إذن الموقع ثم حاول مرة أخرى.');
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
    } finally {
      setSetupBusy(false);
    }
  }, [setupBusy, showToast]);

  const hasExactLocation =
    city !== 'كل المدن' && district !== 'كل الأحياء' && district !== 'كل أحياء المدينة';

  const matchesLocation = useCallback(
    (item: { city?: string | null; district?: string | null }) => isExactDistrictMatching(item, city, district),
    [city, district],
  );

  return {
    region, city, district, ready, apply,
    weather, weatherLoading,
    setupOpen, setSetupOpen, setupBusy, setupMessage,
    promptVisible, snoozePrompt, acceptWeeklyCheck,
    setupRequiredLocation, enableNotifications,
    hasExactLocation, matchesLocation,
    persistLocation,
  };
}
