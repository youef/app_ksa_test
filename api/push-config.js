/**
 * Exposes only the public VAPID key needed by browsers to subscribe to Web Push.
 * Never return the private key from this endpoint.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({
      error: 'Web push is not configured',
      message: 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel environment variables.',
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  return res.status(200).json({ publicKey });
};
