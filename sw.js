/* ============================================================
   sw.js — cacht nur die App-Hülle (HTML/CSS/JS/Icons) dieses
      Ursprungs, damit die App nach dem ersten Laden auch offline
         startet. Deine Daten liegen NICHT hier, sondern in IndexedDB
            (siehe js/db.js) — der Service Worker rührt sie nicht an.
               CDN-Bibliotheken (jsPDF, Tesseract) werden bewusst NICHT
                  gecacht: sie brauchen beim ersten Gebrauch ohnehin Internet.
                     ============================================================ */

                     const CACHE_NAME = 'kontobuch-shell-v1';
                     const APP_SHELL = [
                       './',
                         './index.html',
                           './manifest.json',
                             './css/style.css',
                               './js/db.js',
                                 './js/util.js',
                                   './js/security.js',
                                     './js/settings.js',
                                       './js/customers.js',
                                         './js/invoices.js',
                                           './js/income.js',
                                             './js/expenses.js',
                                               './js/ocr.js',
                                                 './js/euer.js',
                                                   './js/ustva.js',
                                                     './js/reminders.js',
                                                       './js/exportfiles.js',
                                                         './js/app.js',
                                                           './icon-192.png',
                                                             './icon-512.png',
                                                             ];

                                                             self.addEventListener('install', (event) => {
                                                               event.waitUntil(
                                                                   caches.open(CACHE_NAME)
                                                                         .then(cache => cache.addAll(APP_SHELL))
                                                                               .then(() => self.skipWaiting())
                                                                                 );
                                                                                 });

                                                                                 self.addEventListener('activate', (event) => {
                                                                                   event.waitUntil(
                                                                                       caches.keys().then(keys =>
                                                                                             Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
                                                                                                 ).then(() => self.clients.claim())
                                                                                                   );
                                                                                                   });

                                                                                                   // same-origin: cache-first with background refresh; cross-origin (CDN/fonts): network only
                                                                                                   self.addEventListener('fetch', (event) => {
                                                                                                     const url = new URL(event.request.url);
                                                                                                       if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
                                                                                                       
                                                                                                         event.respondWith(
                                                                                                             caches.match(event.request).then(cached => {
                                                                                                                   const network = fetch(event.request).then(resp => {
                                                                                                                           if (resp && resp.ok) {
                                                                                                                                     const clone = resp.clone();
                                                                                                                                               caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                                                                                                                                                       }
                                                                                                                                                               return resp;
                                                                                                                                                                     }).catch(() => cached);
                                                                                                                                                                           return cached || network;
                                                                                                                                                                               })
                                                                                                                                                                                 );
                                                                                                                                                                                 });
                                                                                                                                                                                 
