/* Service worker minimo: serve solo a rendere installabile l'app "Gestione". Nessuna cache: i dati sono sempre aggiornati. */
self.addEventListener("install", e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
