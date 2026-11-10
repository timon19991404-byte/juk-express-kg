
self.addEventListener('install', event => self.skipWaiting());

self.addEventListener('activate', event =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener('push', event => {
  let data = {
    title: 'ЖҮК ЭКСПРЕСС.KG',
    body: 'Жаңы билдирүү келди',
    url: '/'
  };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'juk-express'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clients => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
