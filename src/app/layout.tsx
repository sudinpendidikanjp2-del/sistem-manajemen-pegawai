import type { Metadata, Viewport } from 'next';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmHost } from '@/components/app/confirm-dialog';
import { PwaRegister } from '@/components/app/pwa-register';
import { getSetting } from '@/lib/settings';

// Ikon tab mengikuti logo instansi; tanpa logo (atau saat basis data belum siap) memakai ikon bawaan.
export async function generateMetadata(): Promise<Metadata> {
  const logo = await getSetting('org.logo').catch(() => '');
  return {
    title: { default: 'SIMPEG', template: '%s | SIMPEG' },
    description: 'Sistem Informasi Manajemen Pegawai',
    // Ikon aplikasi terpasang memakai lambang SIMPEG; ikon tab peramban dan layar utama iOS mengikuti logo instansi bila ada.
    icons: { ...(logo ? { icon: `/api/v1/logo?v=${encodeURIComponent(logo)}` } : {}), apple: logo ? `/api/v1/logo?v=${encodeURIComponent(logo)}` : '/icons/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: 'SIMPEG', statusBarStyle: 'default' },
    applicationName: 'SIMPEG',
    formatDetection: { telephone: false },
  };
}

// Zoom tidak dikunci; inset area aman dipakai navigasi bawah. Warna bilah status mengikuti header putih.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-right" richColors closeButton />
        <ConfirmHost />
        <PwaRegister />
      </body>
    </html>
  );
}
