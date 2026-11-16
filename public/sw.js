const OFFLINE_CACHE = 'hayna-offline-v1';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const fallback = await caches.match(OFFLINE_PAGE, { cacheName: OFFLINE_CACHE });
    return fallback ?? Response.error();
  }));
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'حيّنا';
  const body = data.body || 'لديك إشعار جديد';
  const options = {
    body,
    icon: '/brand/HAYNA_LOGO.png',
    badge: '/brand/HAYNA_LOGO.png',
    data: data.data || {},
    tag: data.tag || 'hayna-notification',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const target = new URL('/', self.location.origin).href;
    for (const client of list) {
      if ('focus' in client) return client.focus();
    }
    return clients.openWindow(target);
  }));
});
