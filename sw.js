const CACHE_NAME = 'studex-pwa-v4-fix';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.webmanifest',
    './assets/logo.svg',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/icon-maskable.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => console.warn('Cache failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            // إذا كان الملف موجوداً في الكاش، يتم إرجاعه فوراً
            if (response) {
                return response;
            }
            
            // إذا لم يكن في الكاش، حاول جلبه من الشبكة
            return fetch(e.request).catch(() => {
                // إذا فشل الاتصال بالشبكة أو حدث خطأ في المسار، قم بتسليم واجهة التطبيق
                return caches.match('./index.html');
            });
        })
    );
});