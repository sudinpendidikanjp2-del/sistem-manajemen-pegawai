# SIMPEG sebagai aplikasi (PWA)

SIMPEG bisa dipasang seperti aplikasi di Android, iPhone/iPad, dan komputer, tanpa toko aplikasi dan tanpa aplikasi Android terpisah. Setelah terpasang ia dibuka layar penuh tanpa bilah alamat, punya ikon sendiri di layar utama, dan pintasan tekan-lama ke Absen wajah, Absen dinas luar, dan Laporan kinerja.

## Cara memasang

| Perangkat | Langkah |
|---|---|
| Android (Chrome, Edge, Samsung Internet) | Menu akun (pojok kanan atas) > **Pasang aplikasi**, atau menu peramban > Instal aplikasi. |
| iPhone/iPad (Safari) | Bagikan > **Tambah ke Layar Utama**. Menu akun menampilkan langkahnya. |
| Windows/macOS/Linux (Chrome, Edge) | Ikon pasang di bilah alamat, atau menu akun > **Pasang aplikasi**. |

## Syarat

- **HTTPS.** Pemasangan, kamera, dan lokasi hanya jalan lewat HTTPS (atau `localhost`). Pasang sertifikat di reverse proxy.
- Tombol Pasang aplikasi hanya muncul bila peramban menyatakan aplikasi layak dipasang dan belum terpasang.

## Yang bekerja seperti aplikasi native

- Layar penuh, ikon dan nama sendiri, ikon maskable (bulat atau kotak sesuai peluncur Android), bilah status senada dengan header.
- Kamera dan GPS untuk absen wajah dan dinas luar; peta pin koordinat kantor.
- Notifikasi realtime (SSE) dan toast saat aplikasi terbuka; notifikasi sistem bila izin diberikan dan aplikasi sedang di latar.
- Memuat lebih cepat: berkas aplikasi dan model wajah (sekitar 8 MB) disimpan di perangkat setelah dimuat pertama.
- Tanpa koneksi, aplikasi menampilkan halaman "Tidak ada koneksi" dengan tombol coba lagi.

## Yang sengaja tidak dilakukan

- **Data pegawai tidak disimpan di perangkat.** Halaman dan semua `/api/` selalu dari server; tidak ada absen offline. Absen butuh jam server dan pencocokan wajah di server, dan perangkat bisa dipakai bersama.
- **Belum ada push saat aplikasi tertutup.** Pengingat absen dan notifikasi tiba selama aplikasi terbuka (atau berjalan di latar di Android). Pengingat ke ponsel yang tertutup sepenuhnya butuh Web Push (kunci VAPID dan langganan per perangkat); itu langkah berikutnya bila diperlukan. iOS baru mendukung Web Push untuk aplikasi yang dipasang ke layar utama (iOS 16.4 ke atas).
- Ikon aplikasi terpasang memakai lambang SIMPEG (ukuran ikon dari logo instansi tidak bisa dipastikan). Ikon tab peramban dan layar utama iOS mengikuti logo instansi bila diunggah.

## Perlu aplikasi Android native?

Untuk fitur saat ini tidak. PWA mencakup kamera, GPS, notifikasi, dan pemasangan. Aplikasi native baru bermanfaat bila diperlukan: push yang andal saat aplikasi tertutup di semua perangkat, absen otomatis berdasarkan geofence di latar belakang, atau distribusi lewat Play Store. Bila hanya butuh Play Store, bungkus PWA ini sebagai Trusted Web Activity (Bubblewrap) tanpa mengubah kode aplikasi.

## Berkas terkait

- `src/app/manifest.ts`: nama, ikon, pintasan, warna.
- `public/sw.js`: service worker. Ubah `VERSION` bila isinya berubah.
- `public/icons/`: ikon PNG, dibuat ulang dengan `node scripts/make-icons.mjs`.
- `src/app/offline/`: halaman tanpa koneksi.
- `src/components/app/pwa-register.tsx`, `src/lib/pwa.ts`: pendaftaran dan tombol pasang.
