
self.addEventListener('install', event => self.skipWaiting());

self.addEventListener('activate', event =>
  event.waitUntil(self.clients.claim())
);

function getNotificationUrl(rawUrl) {
  const scope = new URL(self.registration.scope);

  if (!rawUrl || rawUrl === '/') {
    return scope.href;
  }

  // Сайттын папкасын сактап, /messages сыяктуу даректерди оңдоо
  if (rawUrl.startsWith('/')) {
    return new URL(rawUrl.slice(1), scope).href;
  }

  const target = new URL(rawUrl, scope);

  // Эгер сервер домендин түпкү дарегин жөнөтсө,
  // аны сайттын өз папкасына багыттоо
  if (
    target.origin === scope.origin &&
    !target.pathname.startsWith(scope.pathname)
  ) {
    return new URL(
      target.pathname.replace(/^\/+/, '') +
      target.search +
      target.hash,
      scope
    ).href;
  }

  return target.href;
}

self.addEventListener('push', event => {
  let data = {
    title: 'ЖҮК ЭКСПРЕСС.KG',
    body: 'Жаңы билдирүү келди',
    url: ''
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: new URL('icon-192.png', self.registration.scope).href,
      badge: new URL('icon-192.png', self.registration.scope).href,
      data: { url: getNotificationUrl(data.url) },
      tag: data.tag || 'juk-express'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const target = getNotificationUrl(
    event.notification.data?.url
  );

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(async clients => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target);
          return client.focus();
        }
      }

      return self.clients.openWindow(target);
    })
  );
});
