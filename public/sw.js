/**
 * Service worker minimo --- richiesto dai browser (Chrome/Edge/Android)
 * per considerare Hinthial "installabile" (v. manifest.ts). Nessuna
 * cache offline per ora, di proposito: metterne una richiederebbe
 * decidere con cura se e come conservare contenuti già decifrati sul
 * dispositivo, cosa che oggi lo zero-knowledge non prevede --- una
 * fase a sé, non un effetto collaterale di questa.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
