import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vkeuyompnddqfvulalkk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUSH_SECRET = process.env.PUSH_WEBHOOK_SECRET || '';
const VAPID_PUBLIC =
  process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ||
  'BDpMVafZSqdl9ARi4IWpkamC72aZ7D11PKtFfmfI7XzzYqASUpLedMoFtth6tDi8e8ii2MbGABauQjZqCjbzQOo';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

type NotificationRow = { user_id: string; title: string; body: string; type?: string; target_type?: string | null; target_id?: string | null };

function targetUrl(n: NotificationRow) {
  if (n.target_type === 'conversation' && n.target_id) return `/chat/${n.target_id}`;
  if (n.target_type === 'question' && n.target_id) return `/question/${n.target_id}`;
  return '/notifications';
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!PUSH_SECRET || req.headers['x-push-secret'] !== PUSH_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!VAPID_PRIVATE) return res.status(500).json({ error: 'Push server is not configured' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const n: NotificationRow | undefined = body?.record ?? body;
  if (!n?.user_id || !n.title) return res.status(400).json({ error: 'Missing notification' });

  // The database trigger sends the recipient's tokens with the payload, so no service-role key is needed.
  let tokens: { token: string; platform: string }[] = Array.isArray(body?.tokens) ? body.tokens : [];
  if (!tokens.length && SERVICE_KEY) {
    const tokensRes = await supabaseRest(`push_tokens?select=token,platform&user_id=eq.${encodeURIComponent(n.user_id)}`);
    tokens = tokensRes.ok ? await tokensRes.json() : [];
  }

  webpush.setVapidDetails('mailto:support@appksatest.vercel.app', VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = { title: n.title, body: n.body, url: targetUrl(n), tag: n.target_id || undefined };
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    tokens.map(async ({ token, platform }) => {
      try {
        if (platform === 'web') {
          await webpush.sendNotification(JSON.parse(token), JSON.stringify(payload));
        } else {
          const r = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: token, title: n.title, body: n.body, sound: 'default', data: { url: payload.url } }),
          });
          const json = await r.json().catch(() => null);
          if (json?.data?.details?.error === 'DeviceNotRegistered') stale.push(token);
        }
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(token);
        else console.error('push send failed', err?.statusCode, err?.body || err?.message);
      }
    }),
  );

  if (stale.length && SERVICE_KEY) {
    const list = stale.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',');
    await supabaseRest(`push_tokens?token=in.(${encodeURIComponent(list)})`, { method: 'DELETE' });
  }

  return res.status(200).json({ sent, removed: stale.length });
}
