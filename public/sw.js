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
