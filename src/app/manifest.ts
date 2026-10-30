import type { MetadataRoute } from 'next';

// Agar SIMPEG bisa dipasang sebagai aplikasi di ponsel, tablet, dan komputer, dengan pintasan langsung ke absen dan dinas luar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SIMPEG: Absensi dan Kepegawaian',
    short_name: 'SIMPEG',
    description: 'Absensi wajah, rekap kehadiran, cuti, laporan, dan penilaian kinerja pegawai.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#ffffff',
    // Sama dengan warna header aplikasi agar bilah status menyatu.
    theme_color: '#ffffff',
    lang: 'id',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Absen wajah', short_name: 'Absen', url: '/absensi/saya/absen', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Absen dinas luar', short_name: 'Dinas luar', url: '/dinas-luar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Laporan kinerja', short_name: 'Laporan', url: '/kinerja/laporan', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
