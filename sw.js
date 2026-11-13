// 바둑 첫걸음 서비스 워커 (build.mjs가 sw.js로 만든다. sw.js를 직접 고치지 않는다)
// - 주소로 한 번 열면 앱 파일을 기기에 담아 두고, 인터넷이 없을 때 그것으로 연다.
// - 화면(index.html)은 인터넷이 되면 늘 새로 받고(새 판 반영), 안 되면 담아 둔 것을 쓴다.
// - 아이콘 등 나머지는 담아 둔 것을 먼저 쓴다.
const CACHE = 'baduk-guide-1.1.0-bb3893bba7';
const FILES = ["./","index.html","manifest.webmanifest","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-192.png","icons/icon-maskable-512.png","icons/icon.svg"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('baduk-guide-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('index.html', { ignoreSearch: true }))
    );
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
