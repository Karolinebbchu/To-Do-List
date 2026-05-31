// Service Worker — handles Web Push notifications
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() || {} } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || '📌 習慣提醒', {
      body:  data.body  || '',
      icon:  '/favicon.svg',
      badge: '/favicon.svg',
      tag:   data.tag   || 'habit-reminder',
      requireInteraction: true,
      data: { url: self.location.origin },
    })
  )
})

// Tap the notification → open / focus the app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client)
          return client.focus()
      }
      return clients.openWindow('/')
    })
  )
})
