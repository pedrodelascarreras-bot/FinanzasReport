// Fluxen: solo muestra los avisos. No guarda páginas ni archivos: la app siempre se carga
// de la red, así una versión vieja nunca queda trabada en el celular.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Fluxen', {
    body: data.body || '',
    tag: data.key || undefined,
    icon: 'brand/icon-192.png',
    badge: 'brand/icon-192.png',
    data: { page: data.page || null },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const page = event.notification.data && event.notification.data.page;
  const url = new URL(page ? './?page=' + encodeURIComponent(page) : './', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length) {
      await windows[0].focus();
      if (page) windows[0].postMessage({ type: 'fluxen-open', page });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
