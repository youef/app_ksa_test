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
  const raw = typeof globalThis.atob === 'function'
    ? globalThis.atob(base64)
    : '';
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function registerWebPushToken(): Promise<string | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  const publicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('Web push is not configured: EXPO_PUBLIC_VAPID_PUBLIC_KEY is missing.');
    return null;
  }

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('سجّل الدخول قبل تفعيل الإشعارات.');

  const currentPermission = Notification.permission;
  if (currentPermission === 'denied') {
    console.warn('Web push permission is denied; browser settings must be changed manually.');
    return null;
  }

  const permission = currentPermission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return null;

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
  if (error) throw new Error(error.message);
  return token;
}

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return registerWebPushToken();

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
