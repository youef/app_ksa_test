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

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    // Browser permission alone is not a push subscription. The app currently
    // registers Expo push tokens only, so do not report web push as enabled.
    return null;
  }

  try {
    const perms = await Notifications.getPermissionsAsync();
    let final = perms.status;
    if (final !== 'granted') {
      final = (await Notifications.requestPermissionsAsync()).status;
    }
    if (final !== 'granted') return null;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
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
