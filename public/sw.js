const CACHE = 'linkmark-static-v3';
const scopeUrl = new URL(self.registration.scope);

async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  const documentResponse = await fetch(new Request(scopeUrl, { cache: 'reload' }));
  if (!documentResponse.ok) throw new Error('Unable to fetch app shell');
  const documentText = await documentResponse.text();
  await cache.put(scopeUrl, new Response(documentText, { headers: { 'Content-Type': 'text/html' } }));
  const assets = [...documentText.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => new URL(match[1], scopeUrl));
  const scripts = assets.filter((asset) => asset.pathname.endsWith('.js'));
  const scriptSources = await Promise.all(scripts.map(async (asset) => ({ asset, text: await (await fetch(asset, { cache: 'reload' })).text() })));
  for (const source of scriptSources) {
    const workerAssets = [...source.text.matchAll(/\/assets\/[\w.-]+\.js/g)].map((match) => new URL(match[0], scopeUrl));
    assets.push(...workerAssets);
  }
  await cache.addAll([...new Map(assets.map((asset) => [asset.href, asset])).values()]);
}

self.addEventListener('install', (event) => event.waitUntil(precacheAppShell().then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || !['document', 'script', 'style', 'image', 'font', 'worker'].includes(event.request.destination)) return;
  event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); void caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(scopeUrl))));
});
