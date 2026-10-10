import { supabase } from './supabase';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

const PUSH_DISPATCH_URL = 'https://appksatest.vercel.app/api/push-dispatch';

/** Send to all registered devices, including Expo mobile tokens and browser Web Push subscriptions. */
async function dispatchToUsers(
  recipientUserIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const recipients = [...new Set(recipientUserIds.filter(Boolean))];
  if (!recipients.length) return { success: false, sentCount: 0, error: 'لا يوجد مستلمون.' };

  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (sessionError || !accessToken) {
      return { success: false, sentCount: 0, error: 'انتهت جلسة تسجيل الدخول.' };
    }

    const response = await fetch(PUSH_DISPATCH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipientUserIds: recipients,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: payload.sound ?? 'default',
        badge: payload.badge,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const errorMessage = typeof result.error === 'string'
        ? result.error
        : Array.isArray(result.errors) && result.errors.length
          ? result.errors.join('، ')
          : 'تعذر إرسال الإشعارات الفورية.';
      return { success: false, sentCount: Number(result.sentCount || 0), error: errorMessage };
    }
    return { success: true, sentCount: Number(result.sentCount || 0) };
  } catch (error) {
    console.warn('[pushSender] Push dispatch failed', error);
    return {
      success: false,
      sentCount: 0,
      error: error instanceof Error ? error.message : 'تعذر الاتصال بخدمة الإشعارات.',
    };
  }
}

export function sendPushToUser(
  recipientUserId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  return dispatchToUsers([recipientUserId], payload);
}

export function sendPushToMultipleUsers(
  recipientUserIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  return dispatchToUsers(recipientUserIds, payload);
}


/** Sends admin broadcasts to native Expo devices and web push subscriptions via the protected Vercel endpoint. */
export async function sendAdminBroadcastPush(
  recipientUserIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const recipients = [...new Set((recipientUserIds || []).filter(Boolean))];
  if (!recipients.length) return { success: false, sentCount: 0, error: 'لا يوجد مستلمون.' };

  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (sessionError || !accessToken) {
      return { success: false, sentCount: 0, error: 'انتهت جلسة تسجيل الدخول.' };
    }

    const response = await fetch('https://appksatest.vercel.app/api/push-dispatch', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipientUserIds: recipients,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: payload.sound ?? 'default',
        badge: payload.badge,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = typeof result.error === 'string'
        ? result.error
        : Array.isArray(result.errors) && result.errors.length
          ? result.errors.join('، ')
          : 'تعذر إرسال الإشعارات الفورية.';
      return { success: false, sentCount: Number(result.sentCount || 0), error };
    }
    return { success: true, sentCount: Number(result.sentCount || 0) };
  } catch (error) {
    console.warn('[pushSender] Admin broadcast dispatch failed', error);
    return { success: false, sentCount: 0, error: error instanceof Error ? error.message : 'تعذر الاتصال بخدمة الإشعارات.' };
  }
}
