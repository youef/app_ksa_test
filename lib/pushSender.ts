import { supabase } from './supabase';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

/**
 * Sends a real push notification to a user's registered devices via Expo Push API.
 * Safely resolves without throwing errors to avoid breaking the calling UI flow.
 */
export async function sendPushToUser(
  recipientUserId: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number }> {
  try {
    if (!recipientUserId) return { success: false, sentCount: 0 };

    // 1. Fetch recipient push tokens from database
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', recipientUserId);

    if (error || !tokens || tokens.length === 0) {
      return { success: false, sentCount: 0 };
    }

    const expoMessages: any[] = [];

    for (const item of tokens) {
      const token = item.token?.trim();
      if (!token) continue;

      // Handle Expo Push Tokens
      if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
        expoMessages.push({
          to: token,
          sound: payload.sound ?? 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          priority: 'high',
          channelId: 'default',
          badge: payload.badge,
        });
      }
    }

    if (expoMessages.length === 0) {
      return { success: false, sentCount: 0 };
    }

    // 2. Dispatch to Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoMessages),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[pushSender] Expo API returned non-OK status:', response.status, errText);
      return { success: false, sentCount: 0 };
    }

    return { success: true, sentCount: expoMessages.length };
  } catch (err) {
    console.warn('[pushSender] Failed to send push notification:', err);
    return { success: false, sentCount: 0 };
  }
}

/**
 * Sends a push notification to multiple users simultaneously (e.g. urgent district alerts).
 */
export async function sendPushToMultipleUsers(
  recipientUserIds: string[],
  payload: PushNotificationPayload
): Promise<{ success: boolean; sentCount: number }> {
  try {
    if (!recipientUserIds?.length) return { success: false, sentCount: 0 };

    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', recipientUserIds);

    if (error || !tokens?.length) return { success: false, sentCount: 0 };

    const messages = tokens
      .map(t => t.token?.trim())
      .filter(t => t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')))
      .map(t => ({
        to: t,
        sound: payload.sound ?? 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        priority: 'high',
        channelId: 'default',
      }));

    if (!messages.length) return { success: false, sentCount: 0 };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    return { success: true, sentCount: messages.length };
  } catch (err) {
    console.warn('[pushSender] Failed to send batch push:', err);
    return { success: false, sentCount: 0 };
  }
}
