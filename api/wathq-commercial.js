// Wathq sandbox commercial-registration lookup.
// SERVER ONLY: never import this handler into Expo or ship credentials in browser bundles.
// Sandbox values are test data. This endpoint never grants a verified badge.
const { createClient } = require('@supabase/supabase-js');

const RATE = new Map();
const ALLOWED_ACTIONS = new Set(['info', 'status']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const authHeader = req.headers.authorization || '';
  const token = /^Bearer\s+([^\s]+)$/i.exec(authHeader)?.[1];
  if (!token) return res.status(401).json({ error: 'تحتاج إلى تسجيل الدخول.' });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://vkeuyompnddqfvulalkk.supabase.co';
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishable) return res.status(503).json({ error: 'خدمة الاستعلام غير مهيأة على الخادم.' });

  let auth;
  try {
    const db = createClient(supabaseUrl, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    auth = await db.auth.getUser(token);
  } catch {
    return res.status(503).json({ error: 'تعذّر الاتصال بخدمة التحقق من الجلسة.' });
  }
  if (auth.error || !auth.data?.user?.id) return res.status(401).json({ error: 'جلسة الدخول غير صالحة.' });

  // Sandbox-only. Never trust sandbox records as a real official verification.
  const key = process.env.WATHQ_SANDBOX_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: 'الاستعلام التجريبي عبر واثق جاهز برمجيًا، ويحتاج مفتاحًا جديدًا محفوظًا في إعدادات الخادم.',
      code: 'wathq_not_configured',
    });
  }

  const id = String(req.body?.id || '').trim();
  const action = String(req.body?.action || 'info');
  if (!/^[0-9]{10,15}$/.test(id) || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: 'رقم السجل أو الرقم الوطني الموحد غير صالح.' });
  }

  // Best-effort per instance cooldown to reduce accidental trial quota usage.
  // This is not a distributed rate limit. Do not point this endpoint at a paid production API.
  const uid = auth.data.user.id;
  const now = Date.now();
  const prev = RATE.get(uid) || [];
  const recent = prev.filter(t => t > now - 60_000);
  if (recent.length >= 3) return res.status(429).json({ error: 'بلغت حد الاستعلام التجريبي. حاول مجددًا بعد دقيقة.' });
  recent.push(now);
  RATE.set(uid, recent);
  if (RATE.size > 1500) RATE.clear();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const url = 'https://api.wathq.sa/sandbox/commercial-registration/' + action + '/' + encodeURIComponent(id) + '?language=ar';
    const response = await fetch(url, {
      method: 'GET',
      headers: { apiKey: key, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 404) return res.status(404).json({ error: 'لم يُعثر على سجل بهذه البيانات في البيئة الاختبارية.' });
    if ([401, 403].includes(response.status)) return res.status(502).json({ error: 'مفتاح الاستعلام التجريبي غير مفعل لهذه الخدمة.' });
    if (response.status === 429) return res.status(429).json({ error: 'بلغت الخدمة حد استعلاماتها التجريبية.' });
    if (!response.ok) return res.status(502).json({ error: 'تعذر الحصول على نتيجة من بيئة واثق التجريبية.' });

    const data = await response.json();
    const name = typeof data?.name === 'string' ? data.name : null;
    const status = typeof data?.status?.name === 'string' ? data.status.name : typeof data?.name === 'string' && action === 'status' ? data.name : null;
    return res.status(200).json({
      mode: 'sandbox',
      source: 'wathq',
      requestType: action,
      name: action === 'info' ? name : null,
      status: status || null,
      crNumber: action === 'info' ? String(data?.crNumber || '') : null,
      crNationalNumber: action === 'info' ? String(data?.crNationalNumber || '') : null,
      city: action === 'info' ? String(data?.headquarterCityName || '') : null,
      notice: 'بيانات تجريبية فقط. لا تثبت وجود سجل حقيقي أو ملكية المستخدم ولا تمنح توثيقًا.',
    });
  } catch {
    return res.status(504).json({ error: 'تعذّر الاتصال بواثق التجريبية. يمكنك استخدام الاستعلام الحكومي الرسمي.' });
  } finally {
    clearTimeout(timeout);
  }
};
