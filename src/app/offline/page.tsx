import { WifiOff } from 'lucide-react';
import { RetryButton } from './retry-button';

export const metadata = { title: 'Tidak ada koneksi' };

// Disimpan service worker dan ditampilkan saat perangkat tidak bisa menjangkau server.
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-10 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-accent text-primary" aria-hidden><WifiOff className="size-8" /></span>
        <h1 className="text-2xl font-bold">Tidak ada koneksi</h1>
        <p className="text-muted-foreground">SIMPEG membutuhkan jaringan untuk absen dan menampilkan data pegawai. Periksa Wi-Fi atau paket data, lalu coba lagi. Data Anda tidak disimpan di perangkat ini.</p>
        <RetryButton />
      </div>
    </main>
  );
}
