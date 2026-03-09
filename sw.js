// HANNAH Service Worker
// キャッシュ戦略: Cache First (オフライン優先)

const CACHE_NAME = 'hannah-v0.1.20';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ── インストール: コアアセットをキャッシュ ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── アクティベート: 古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── フェッチ: Cache First → Network Fallback ──
self.addEventListener('fetch', event => {
  // chrome-extension や非httpリクエストは無視
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // 有効なレスポンスのみキャッシュ
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // オフライン時のフォールバック
        return caches.match('./index.html');
      });
    })
  );
});

// ── バックグラウンド同期（将来の拡張用） ──
self.addEventListener('sync', event => {
  if (event.tag === 'hannah-sync') {
    // 将来: P2P同期・クラウドバックアップ
    console.log('[SW] Background sync triggered');
  }
});
