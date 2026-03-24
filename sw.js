// Service Worker for SecureVault
// Enables offline functionality and app-like experience

const CACHE_VERSION = 'vault-v1.0.0';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Install event: Cache essential files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Caching app files');
        return cache.addAll(CACHE_URLS).catch(() => {
          // Network error is OK during install - files will be cached on first load
          console.log('[SW] Some files failed to cache (this is OK)');
        });
      })
  );
  
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
  );
  
  self.clients.claim();
});

// Fetch event: Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip API calls (if any)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response('Offline - API not available', { status: 503 }))
    );
    return;
  }
  
  // Cache-first strategy for app files
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          console.log(`[SW] Serving from cache: ${request.url}`);
          return response;
        }
        
        console.log(`[SW] Fetching from network: ${request.url}`);
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_VERSION)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });
            }
            return response;
          })
          .catch(() => {
            // Network request failed
            console.log(`[SW] Network failed for: ${request.url}`);
            
            // Return offline page if available
            return caches.match('/index.html')
              .then((response) => {
                return response || new Response(
                  'Offline - App not available',
                  { status: 503 }
                );
              });
          });
      })
  );
});

// Message event: Allow clients to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'SecureVault notification',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%2300d4ff" width="192" height="192"/><text x="50%" y="50%" font-size="120" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="%230f1419" font-family="Arial">🔐</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><text font-size="60" text-anchor="middle" x="48" y="60" fill="%2300d4ff">🔐</text></svg>'
  };
  
  event.waitUntil(
    self.registration.showNotification('SecureVault', options)
  );
});

console.log('[SW] Service Worker loaded');