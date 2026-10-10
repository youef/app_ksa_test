const webpush = require('web-push');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vkeuyompnddqfvulalkk.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

async function requestJson(path, key, bearer) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer || key}`,
      Accept: 'application/json',
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.msg || `Supabase request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const accessToken = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';
  if (!accessToken) return res.status(401).json({ ok: false, error: 'سجّل الدخول أولاً.' });
  if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'خدمة الإشعارات غير مكتملة. أضف SUPABASE_PUBLISHABLE_KEY وSUPABASE_SERVICE_ROLE_KEY إلى إعدادات Vercel.',
    });
  }

  try {
    // Validate the caller's user session with Supabase Auth.
    const user = await requestJson('/auth/v1/user', SUPABASE_ANON_KEY, accessToken);
    if (!user?.id) return res.status(401).json({ ok: false, error: 'جلسة تسجيل الدخول غير صالحة.' });

    // Service-role access is server-only and bypasses recipient RLS for token lookup.
    const profiles = await requestJson(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
      SUPABASE_SERVICE_KEY
    );
    const email = String(user.email || '').toLowerCase();
    if (profiles?.[0]?.role !== 'admin' && email !== 'root@gmail.com') {
      return res.status(403).json({ ok: false, error: 'إرسال التنبيهات العامة متاح للإدارة فقط.' });
    }

    const body = req.body || {};
    const recipientUserIds = Array.isArray(body.recipientUserIds)
      ? [...new Set(body.recipientUserIds.filter(validUuid))].slice(0, 2000)
      : [];
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    const message = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
    if (!recipientUserIds.length || !title || !message) {
      return res.status(400).json({ ok: false, error: 'المستلمون والعنوان ونص التنبيه مطلوبة.' });
    }

    const tokens = await requestJson(
      `/rest/v1/push_tokens?user_id=in.(${recipientUserIds.join(',')})&select=user_id,token,platform`,
      SUPABASE_SERVICE_KEY
    );

    const expoMessages = [];
    const webSubscriptions = [];
    for (const item of tokens || []) {
      const token = typeof item.token === 'string' ? item.token.trim() : '';
      if (!token) continue;
      if (/^(Expo|Exponent)PushToken\[/.test(token)) {
        expoMessages.push({
          to: token,
          sound: body.sound === null ? undefined : (body.sound || 'default'),
          title,
          body: message,
          data,
          priority: 'high',
          channelId: 'default',
          badge: Number.isInteger(body.badge) ? body.badge : undefined,
        });
      } else if (item.platform === 'web' || token.startsWith('{')) {
        try {
          const subscription = JSON.parse(token);
          if (subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth) {
            webSubscriptions.push({ subscription, userId: item.user_id, token });
          }
        } catch (_) {}
      }
    }

    const result = { expoSent: 0, webSent: 0, errors: [] };
    for (let i = 0; i < expoMessages.length; i += 100) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(expoMessages.slice(i, i + 100)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        result.errors.push(`Expo returned HTTP ${response.status}`);
        continue;
      }
      const tickets = Array.isArray(payload.data) ? payload.data : (payload.data ? [payload.data] : []);
      result.expoSent += tickets.filter(ticket => ticket.status === 'ok').length;
      for (const ticket of tickets) {
        if (ticket.status === 'error') result.errors.push(ticket.message || ticket.details?.error || 'Expo rejected a device token');
      }
    }

    if (webSubscriptions.length) {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      if (!publicKey || !privateKey) {
        result.errors.push('أضف VAPID_PUBLIC_KEY وVAPID_PRIVATE_KEY إلى Vercel.');
      } else {
        webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@hayna.app', publicKey, privateKey);
        for (const entry of webSubscriptions) {
          try {
            await webpush.sendNotification(entry.subscription, JSON.stringify({
              title,
              body: message,
              data,
              tag: `hayna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            }), { TTL: 3600, urgency: 'high' });
            result.webSent += 1;
          } catch (error) {
            result.errors.push(`Web Push HTTP ${error.statusCode || 500}`);
            // Remove expired browser subscriptions so future sends do not keep failing.
            if (error.statusCode === 404 || error.statusCode === 410) {
              await fetch(`${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${encodeURIComponent(entry.userId)}&token=eq.${encodeURIComponent(entry.token)}`, {
                method: 'DELETE',
                headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
              }).catch(() => {});
            }
          }
        }
      }
    }

    const sentCount = result.expoSent + result.webSent;
    return res.status(200).json({
      ok: sentCount > 0,
      sentCount,
      expoSent: result.expoSent,
      webSent: result.webSent,
      registeredDevices: (tokens || []).length,
      errors: result.errors.slice(0, 8),
      error: sentCount ? undefined : (result.errors[0] || 'لا توجد أجهزة مسجلة لاستقبال الإشعارات.'),
    });
  } catch (error) {
    const status = error.status === 401 || error.status === 403 ? error.status : 500;
    return res.status(status).json({ ok: false, error: error.message || 'تعذر إرسال الإشعارات.' });
  }
};
