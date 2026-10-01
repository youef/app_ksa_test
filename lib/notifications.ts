import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { isDndActiveNow, loadDnd } from './chatControls';

// ---------------------------------------------------------------
// Do Not Disturb: silences sound/vibration and hides the banner,
// so a muted conversation or an active DND window stays quiet.
// ---------------------------------------------------------------
let dndActive = false;

export function setNotificationDnd(active: boolean) {
  dndActive = active;
}

export function isNotificationDnd(): boolean {
  return dndActive;
}

/** Reads the profile and syncs the DND state into the notification handler. */
export async function syncDndWithNotifications(userId?: string): Promise<boolean> {
  try {
    const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return false;
    const dnd = await loadDnd(uid);
    const active = isDndActiveNow(dnd);
    setNotificationDnd(active);
    return active;
  } catch (err) {
    console.warn('syncDndWithNotifications error', err);
    return false;
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: !dndActive,
    shouldSetBadge: !dndActive,
    shouldShowBanner: !dndActive,
    shouldShowList: !dndActive,
  }),
});

const WEB_PUSH_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
  'BDpMVafZSqdl9ARi4IWpkamC72aZ7D11PKtFfmfI7XzzYqASUpLedMoFtth6tDi8e8ii2MbGABauQjZqCjbzQOo';

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function isIosBrowser() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandaloneWebApp() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

/** Whether the current browser already has an active push subscription saved. */
export async function hasWebPushSubscription(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return !!(await reg?.pushManager.getSubscription());
  } catch { return false; }
}

async function registerWebPush(prompt: boolean): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  if (!supported) {
    if (!prompt) return null;
    if (isIosBrowser() && !isStandaloneWebApp()) {
      throw new Error('على الآيفون: افتح الموقع في Safari، اضغط زر المشاركة ثم "إضافة إلى الشاشة الرئيسية"، وافتح حيّنا من الأيقونة ثم فعّل الإشعارات من الإعدادات. (يتطلب iOS 16.4 أو أحدث)');
    }
    throw new Error('هذا المتصفح لا يدعم الإشعارات الفورية.');
  }

  // iOS only allows the permission prompt from a user tap, so background
  // re-registration runs only once permission was already granted.
  if (!prompt && Notification.permission !== 'granted') return null;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    if (!prompt) return null;
    throw new Error('تم رفض إذن الإشعارات. فعّله من إعدادات الجهاز ثم حاول مجدداً.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY) }));

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('سجّل الدخول قبل تفعيل الإشعارات.');
  const token = JSON.stringify(subscription.toJSON());
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: u.user.id, token, platform: 'web' }, { onConflict: 'token' });
  if (error) throw new Error(error.message);
  return token;
}

/**
 * Registers this device for push. `prompt` = triggered by a user tap; on web
 * it then throws with a readable reason instead of failing silently.
 */
export async function registerPushToken(options: { prompt?: boolean } = {}): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return await registerWebPush(!!options.prompt);
    } catch (err) {
      if (options.prompt) throw err;
      console.warn('registerWebPush error', err);
      return null;
    }
  }

  try {
    const perms = await Notifications.getPermissionsAsync();
    let final = perms.status;
    if (final !== 'granted') {
      final = (await Notifications.requestPermissionsAsync()).status;
    }
    if (final !== 'granted') return null;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: '5228885c-729d-4f4a-935d-06662dfd4beb' })).data;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('سجّل الدخول قبل تسجيل هذا الجهاز للإشعارات.');

    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: u.user.id, token, platform: Platform.OS }, { onConflict: 'token' });
    if (error) throw new Error(error.message);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'حيّنا',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    return token;
  } catch (err) {
    console.warn('registerPushToken error', err);
    return null;
  }
}
