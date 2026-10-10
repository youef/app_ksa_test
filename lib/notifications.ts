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
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof globalThis.atob === 'function' ? globalThis.atob(base64) : '';
  if (!raw) throw new Error('تعذر تجهيز مفتاح إشعارات المتصفح.');
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function getWebPushPublicKey(): Promise<string> {
  const envKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;

  // Read the public VAPID key from Vercel at runtime so it does not need
  // to be duplicated as a build-time Expo public environment variable.
  const response = await fetch('/api/push-config', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error('خدمة إشعارات الويب غير مهيأة على الخادم. يلزم ضبط VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY في إعدادات Vercel.');
  }
  const config = await response.json();
  if (typeof config.publicKey !== 'string' || !config.publicKey) {
    throw new Error('مفتاح إشعارات الويب غير موجود في إعدادات Vercel. أضف VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY ثم أعد النشر.');
  }
  return config.publicKey;
}

async function registerWebPushToken(): Promise<string> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    throw new Error('هذا المتصفح لا يدعم إشعارات الويب الفورية. افتح حيّنا في متصفح حديث أو استخدم تطبيق الجوال.');
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (isIOS && !isStandalone) {
    throw new Error('على الآيفون، أضف حيّنا إلى الشاشة الرئيسية أولاً: اضغط مشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية»، وافتح حيّنا من الأيقونة الجديدة ثم فعّل الإشعارات.');
  }

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('سجّل الدخول قبل تفعيل الإشعارات.');

  const publicKey = await getWebPushPublicKey();
  const currentPermission = Notification.permission;
  if (currentPermission === 'denied') {
    throw new Error('إذن الإشعارات مرفوض من إعدادات المتصفح. افتح إعدادات الموقع appksatest.vercel.app واسمح بالإشعارات، ثم أعد المحاولة.');
  }

  const permission = currentPermission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('لم تمنح إذن الإشعارات. اختر «سماح» في نافذة المتصفح ثم أعد المحاولة.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }

  const token = JSON.stringify(subscription.toJSON());
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: u.user.id, token, platform: 'web' }, { onConflict: 'token' });
  if (error) throw new Error('تم السماح بالإشعارات لكن تعذر حفظ الجهاز: ' + error.message);
  return token;
}

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return registerWebPushToken();

  try {
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission prompt after a notification channel exists.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'حيّنا',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const perms = await Notifications.getPermissionsAsync();
    let final = perms.status;
    if (final !== 'granted') {
      final = (await Notifications.requestPermissionsAsync()).status;
    }
    if (final !== 'granted') {
      throw new Error('إذن إشعارات الجوال غير مسموح. افتح إعدادات الجهاز ← حيّنا ← الإشعارات وفعّل السماح.');
    }

    const projectId = 'f8205dc7-21de-46d3-aa97-57f2249a81ed';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('سجّل الدخول قبل تسجيل هذا الجهاز للإشعارات.');

    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: u.user.id, token, platform: Platform.OS }, { onConflict: 'token' });
    if (error) throw new Error('تعذر حفظ تسجيل الإشعارات: ' + error.message);
    return token;
  } catch (err) {
    console.warn('registerPushToken error', err);
    if (err instanceof Error) throw err;
    throw new Error('تعذر تسجيل الإشعارات. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  }
}
