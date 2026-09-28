/* Avisos con la app cerrada: se importa dentro del service worker generado por Workbox. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Recordatorios';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Solo rutas de esta misma app: el payload viene del servidor, pero nunca se abre otro origen.
  let target = '/';
  try {
    const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
    if (url.origin === self.location.origin) target = url.pathname + url.search + url.hash;
  } catch {
    /* URL no válida: se abre la raíz */
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          return win.focus().then((focused) => (target !== '/' && focused && 'navigate' in focused ? focused.navigate(target) : focused));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
