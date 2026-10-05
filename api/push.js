const webpush = require('web-push');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret || req.headers['x-push-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { record, tokens = [] } = req.body || {};
  if (!record || !Array.isArray(tokens)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const title = record.title || 'حيّنا';
  const body = record.body || 'لديك إشعار جديد';
  const data = record.data || {};

  const expoMessages = [];
  const webMessages = [];

  for (const item of tokens) {
    const token = item && item.token;
    if (!token) continue;
    if (item.platform === 'web') {
      try {
        webMessages.push(JSON.parse(token));
      } catch (_) {}
    } else {
      expoMessages.push({ to: token, title, body, data, sound: 'default' });
    }
  }

  const results = { expo: null, web: [] };

  if (expoMessages.length) {
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expoMessages),
    });
    results.expo = await expoResponse.json();
  }

  if (webMessages.length) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
    if (!publicKey || !privateKey) {
      return res.status(500).json({ error: 'Web push VAPID keys are not configured' });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    for (const subscription of webMessages) {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title, body, data, tag: record.id || 'hayna-notification' }));
        results.web.push({ ok: true });
      } catch (error) {
        results.web.push({ ok: false, statusCode: error.statusCode || 500 });
      }
    }
  }

  return res.status(200).json({ ok: true, results });
};

// Force a fresh production deployment so updated Vercel environment variables are loaded.

// Force production redeploy after Vercel Production environment variables were updated.
