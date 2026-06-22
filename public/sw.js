/*
 * AutoStand — Service Worker (PWA, Fase 1)
 *
 * Estratégia conservadora para um app dinâmico e autenticado:
 *  - Navegações (HTML): network-first; offline → página de fallback inline.
 *    NUNCA cacheia HTML (evita vazar página de um lojista para outro / stale).
 *  - Assets estáticos do Next (/_next/static, ícones): stale-while-revalidate.
 *  - /api e métodos não-GET: passthrough puro (nunca tocados pelo SW).
 *
 * Bump o CACHE_VERSION para invalidar o cache de assets num deploy.
 */
const CACHE_VERSION = "autostand-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão — AutoStand</title>
<style>
  :root { color-scheme: light }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background:#F6F7F8; color:#0B1F33; padding:24px; box-sizing:border-box }
  .card { max-width:340px; text-align:center }
  .dot { width:56px; height:56px; border-radius:16px; background:#0B1F33; margin:0 auto 20px;
    display:flex; align-items:center; justify-content:center; color:#FF6A1A; font-weight:800; font-size:22px }
  h1 { font-size:18px; margin:0 0 8px }
  p { color:#6B7A88; font-size:14px; line-height:1.5; margin:0 0 20px }
  button { background:#FF6A1A; color:#0B1F33; border:0; border-radius:10px;
    padding:11px 20px; font-size:14px; font-weight:700; cursor:pointer }
</style></head>
<body><div class="card">
  <div class="dot">AS</div>
  <h1>Você está sem conexão</h1>
  <p>Não foi possível carregar esta página. Verifique sua internet e tente de novo.</p>
  <button onclick="location.reload()">Tentar novamente</button>
</div></body></html>`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        "/icon-192.png",
        "/icon-512.png",
        "/icon-maskable-512.png",
      ]).catch(() => {}),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/favicon.ico" ||
    url.pathname.startsWith("/banks/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // nunca tocar APIs/auth

  // Navegações (HTML): network-first, fallback offline. Não cacheia.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  // Assets estáticos: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok && res.type === "basic") cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
