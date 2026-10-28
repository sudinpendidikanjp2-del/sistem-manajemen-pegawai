/* Service worker SIMPEG.
 * Tujuan: bisa dipasang sebagai aplikasi, memuat cepat, dan menampilkan halaman "Tidak ada koneksi" saat offline.
 * Yang sengaja TIDAK disimpan: halaman yang berisi data pegawai dan semua /api/ (data pribadi, perangkat bisa dipakai bersama).
 * Naikkan VERSION bila isi berkas ini berubah supaya cache lama dibuang. */
const VERSION = 'v1';
const SHELL = `simpeg-shell-${VERSION}`;
const STATIC = `simpeg-static-${VERSION}`;
const MODELS = `simpeg-models-${VERSION}`;
const KEEP = [SHELL, STATIC, MODELS];
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/icon.svg']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('simpeg-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Cache dulu; bila belum ada ambil dari jaringan lalu simpan. Untuk berkas yang tidak berubah (hash di nama, model wajah). */
async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Tampilkan yang tersimpan sekarang, perbarui di belakang layar. */
async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fresh = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ubin peta dan layanan lain biarkan peramban
  const path = url.pathname;

  if (path.startsWith('/api/')) return; // data selalu dari server, termasuk stream notifikasi
  if (path.startsWith('/face-assets/')) { event.respondWith(cacheFirst(MODELS, request)); return; } // model wajah ~8 MB: unduh sekali
  if (path.startsWith('/_next/static/')) { event.respondWith(cacheFirst(STATIC, request)); return; }
  if (path.startsWith('/icons/') || path === '/icon.svg') { event.respondWith(staleWhileRevalidate(SHELL, request)); return; }

  // Halaman: selalu dari jaringan. Bila tidak ada koneksi, tampilkan halaman offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response('Tidak ada koneksi.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })),
    );
  }
});
